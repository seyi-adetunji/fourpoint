import { UserRepository } from "@/repositories/userRepository";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export class UserService {
  static async getAllUsers(filters?: Prisma.UserWhereInput) {
    return UserRepository.findAll(filters);
  }

  static async getUserById(id: string) {
    return UserRepository.findById(id);
  }

  static async createUser(data: Prisma.UserCreateInput & { plainPassword?: string }) {
    if (data.plainPassword) {
      data.passwordHash = await bcrypt.hash(data.plainPassword, 10);
      delete data.plainPassword;
    }

    return UserRepository.create(data);
  }

  static async updateUser(id: string, data: Prisma.UserUpdateInput & { plainPassword?: string }) {
    if (data.plainPassword) {
      data.passwordHash = await bcrypt.hash(data.plainPassword, 10);
      delete data.plainPassword;
    }
    return UserRepository.update(id, data);
  }

  static async deleteUser(id: string) {
    // Add business logic to avoid deleting self or only super admin
    return UserRepository.delete(id);
  }
}
