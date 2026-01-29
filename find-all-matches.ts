import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=7ca044d7-5942-4ace-a0d1-e874a6515ba8');

async function findAllMatches() {
  console.log('Searching ALL program accounts...');
  
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  
  console.log(`Found ${accounts.length} accounts:\n`);
  
  for (const account of accounts) {
    const data = account.account.data;
    
    // Read player_a at offset 8
    const playerA = new PublicKey(data.slice(8, 40));
    
    // Read stake tier at offset 73
    const stakeTier = data[73];
    const status = data[82];
    const statusNames = ['Open', 'Active', 'Finished', 'Cancelled'];
    
    // Get escrow balance
    const [escrowPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), account.pubkey.toBuffer()],
      PROGRAM_ID
    );
    const escrowBalance = await connection.getBalance(escrowPDA);
    
    console.log('Match PDA:', account.pubkey.toBase58());
    console.log('Player A:', playerA.toBase58());
    console.log('Stake Tier:', stakeTier);
    console.log('Status:', statusNames[status] || `Unknown (${status})`);
    console.log('Escrow PDA:', escrowPDA.toBase58());
    console.log('Escrow Balance:', escrowBalance / 1e9, 'SOL');
    console.log('---');
  }
}

findAllMatches().catch(console.error);
