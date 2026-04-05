# Coordinator First-Run Checklist

Use this checklist after the proof-of-concept environment is seeded and the
real co-ordinator logs in for the first time.

## Access and safety

1. Confirm the correct hospital/site name is visible.
2. Change the temporary password immediately.
3. Store the new password in the approved team password manager.
4. Do not share the co-ordinator account with other staff.
5. Plan to enable MFA as soon as the deployment is ready for it.

## Template review

1. Open `Templates`.
2. Check that the POCT Blood Gas templates are present.
3. Open each template and confirm the real wording, sections, and checklist
   items are correct.
4. Archive any placeholder or unwanted templates before wider testing.

## Basic setup

1. Open `Users`.
2. Add only the minimum real users needed for the proof of concept.
3. Add trainer accounts before adding large numbers of trainees.
4. Open `Section setup` and confirm the POCT units are correct.

## Proof-of-concept workflow

1. Create one or two real assignments.
2. Enter one test training record.
3. Confirm the dashboard, due dates, and record detail behave as expected.
4. Confirm no patient-identifiable clinical data is being entered.

## Governance check

1. Review who has access to the Render project and database.
2. Confirm the private seed JSON is stored only in Render secret files or other
   approved private storage.
3. Remove any unneeded temporary accounts after testing.
4. Decide whether the next phase should continue with demo data, real data, or
   a fresh clean database.
