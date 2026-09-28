// Usage: npm run staff:create -- <email> "<Full Name>"
// Prompts for the password (hidden). Re-running for an existing email resets the password.
import 'dotenv/config';
import { createInterface } from 'node:readline';
import { getDb } from '../db';
import { staffUsers } from '../db/schema';
import { hashPassword } from './password';

function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void };
  let prompted = false;
  out._writeToOutput = (s) => {
    if (!prompted) {
      process.stdout.write(s);
      prompted = true;
    }
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

async function main() {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) {
    console.error('Usage: npm run staff:create -- <email> "<Full Name>"');
    process.exit(1);
  }
  const password = await askHidden('Password (min 12 characters): ');
  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  await getDb()
    .insert(staffUsers)
    .values({ email: email.trim().toLowerCase(), name, passwordHash })
    .onConflictDoUpdate({ target: staffUsers.email, set: { name, passwordHash, disabledAt: null } });
  console.log(`Staff account ready: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
