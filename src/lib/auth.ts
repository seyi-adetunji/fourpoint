import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const fs = require('fs');
        const log = (msg: string) => {
          try { fs.appendFileSync('auth-debug.log', new Date().toISOString() + ': ' + msg + '\n'); } catch (e) {}
        };
        
        log(`Authorize called for: ${credentials?.email}`);
        
        const email = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email }
        });

        log(`User found: ${user ? 'YES' : 'NO'}`);

        if (!user) {
          log('Rejected: User not found in DB');
          throw new Error("Invalid email or password");
        }

        let password = credentials.password;
        if (typeof password === 'string') {
          password = password.trim();
        }
        
        const isValid = await bcrypt.compare(password, user.passwordHash);
        log(`Password valid: ${isValid}`);

        if (!isValid) {
          log('Rejected: Password mismatch');
          throw new Error("Invalid email or password");
        }
        
        log('Accepted! Returning user object.');

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId ?? null,
          departmentId: user.departmentId ?? null,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.departmentId = user.departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          employeeId: (token.employeeId as number | null) ?? null,
          departmentId: (token.departmentId as number | null) ?? null,
        };
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // We will build this page later
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};
