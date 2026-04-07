import { Pool, PoolClient, QueryResultRow } from "pg";

type Queryable = Pool | PoolClient;

export interface EmailDispatchReservation {
  id: number;
}

interface ReserveEmailDispatchInput {
  dedupeKey: string;
  entityId: number;
  entityType: string;
  notificationType: string;
  payloadSummary?: Record<string, unknown>;
  recipientEmail: string;
}

export async function reserveEmailDispatch(
  db: Queryable,
  input: ReserveEmailDispatchInput,
) {
  const result = await db.query<EmailDispatchReservation>(
    `
    INSERT INTO email_dispatch_log (
      notification_type,
      entity_type,
      entity_id,
      recipient_email,
      dedupe_key,
      payload_summary
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id
    `,
    [
      input.notificationType,
      input.entityType,
      input.entityId,
      input.recipientEmail.trim().toLowerCase(),
      input.dedupeKey,
      JSON.stringify(input.payloadSummary ?? {}),
    ],
  );

  return result.rows[0];
}

export async function markEmailDispatchSent(db: Queryable, reservationId: number) {
  await db.query(
    `
    UPDATE email_dispatch_log
    SET
      status = 'sent',
      sent_at = NOW()
    WHERE id = $1
    `,
    [reservationId],
  );
}

export async function releaseEmailDispatchReservation(
  db: Queryable,
  reservationId: number,
) {
  await db.query(
    `
    DELETE FROM email_dispatch_log
    WHERE id = $1
      AND status = 'pending'
    `,
    [reservationId],
  );
}

export async function withEmailDispatchGuard<T extends QueryResultRow>(
  db: Queryable,
  input: ReserveEmailDispatchInput & {
    send: () => Promise<T | void>;
  },
) {
  const reservation = await reserveEmailDispatch(db, input);

  if (!reservation) {
    return {
      duplicate: true,
      result: undefined,
    };
  }

  try {
    const result = await input.send();
    await markEmailDispatchSent(db, reservation.id);

    return {
      duplicate: false,
      result,
    };
  } catch (error) {
    await releaseEmailDispatchReservation(db, reservation.id);
    throw error;
  }
}
