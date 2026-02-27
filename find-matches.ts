import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const PLAYER = new PublicKey('9fNSVxsrju6YjkBSp7LqR9pPXJSZv34s4VevFaBuFtv');

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);

async function findMatches() {
  console.log('Searching for matches created by:', PLAYER.toBase58());
  console.log('Program:', PROGRAM_ID.toBase58());
  
  // Get all program accounts
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: PLAYER.toBase58(), // player_a field
        },
      },
    ],
  });
  
  console.log(`\nFound ${accounts.length} match accounts:\n`);
  
  for (const account of accounts) {
    const data = account.account.data;
    console.log('Match PDA:', account.pubkey.toBase58());
    console.log('Lamports:', account.account.lamports);
    
    // Parse status (offset varies, let's check raw data)
    // Discriminator: 8 bytes
    // player_a: 32 bytes (offset 8)
    // player_b: 1 + 32 bytes (Option<Pubkey>, offset 40)
    // stake_tier: 1 byte (offset 73)
    // join_deadline: 8 bytes (offset 74)
    // status: 1 byte (offset 82)
    
    const stakeTier = data[73];
    const status = data[82];
    const statusNames = ['Open', 'Active', 'Finished', 'Cancelled'];
    
    console.log('Stake Tier:', stakeTier);
    console.log('Status:', statusNames[status] || `Unknown (${status})`);
    
    // Check escrow PDA balance
    const [escrowPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), account.pubkey.toBuffer()],
      PROGRAM_ID
    );
    const escrowBalance = await connection.getBalance(escrowPDA);
    console.log('Escrow PDA:', escrowPDA.toBase58());
    console.log('Escrow Balance:', escrowBalance / 1e9, 'SOL');
    console.log('---');
  }
}

findMatches().catch(console.error);
