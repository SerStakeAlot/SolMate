import { Connection, PublicKey } from '@solana/web3.js';

const MATCH_PDA = new PublicKey('9sGh52Wgbw5wx3dwoyLcWUkyTzAesFUge9BiWnVJrhMh');
const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);

async function checkDeadline() {
  const account = await connection.getAccountInfo(MATCH_PDA);
  if (!account) {
    console.log('Account not found');
    return;
  }
  
  // Read join_deadline (i64 at offset 74)
  const data = account.data;
  const deadlineBuffer = data.slice(74, 82);
  const deadline = deadlineBuffer.readBigInt64LE();
  
  const deadlineDate = new Date(Number(deadline) * 1000);
  const now = new Date();
  
  console.log('Join Deadline:', deadlineDate.toISOString());
  console.log('Current Time:', now.toISOString());
  console.log('Deadline Passed:', now > deadlineDate);
  
  if (now > deadlineDate) {
    console.log('\n✅ You CAN claim a refund - the deadline has passed!');
  } else {
    const remaining = (deadlineDate.getTime() - now.getTime()) / 1000 / 60;
    console.log(`\n⏳ Wait ${remaining.toFixed(1)} more minutes before claiming refund`);
  }
}

checkDeadline().catch(console.error);
