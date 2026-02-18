import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";

import { Role } from "shared-types";

export interface User {
  _id?: ObjectId;
  email: string;
  password: string;
  role: Role;
}

export async function createUser(
  db: any,
  email: string,
  password: string,
  role: Role,
) {
  const hashed = await bcrypt.hash(password, 10);

  const user: User = {
    email,
    password: hashed,
    role,
  };

  await db.collection("users").insertOne(user);
}

export async function findUserByEmail(db: any, email: string) {
  return db.collection("users").findOne({ email });
}
