import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const RPC = 'https://mainnet.helius-rpc.com/?api-key=REDACTED_HELIUS_API_KEY';

async function main() {
  const connection = new Connection(RPC, 'confirmed');
  
  console.log('Fetching ALL program accounts...\n');
  const accounts = await connection.getProgramAccounts(PROGRAM_ID);
  console.log(`Found ${accounts.length} accounts total\n`);
  
  // Match struct layout (after 8-byte discriminator):
  // player_a: Pubkey (32)        -> bytes 8-39
  // player_b: Option<Pubkey> (33)-> bytes 40-72 (byte 40 = Some/None, 41-72 = pubkey if Some)
  // stake_tier: u8 (1)           -> byte 73
  // join_deadline: i64 (8)       -> bytes 74-81
  // status: u8 (1)               -> byte 82
  // winner: Option<Pubkey> (33)  -> bytes 83-115 (byte 83 = Some/None, 84-115 = pubkey if Some)
  // bump: u8 (1)                 -> byte 116
  // escrow_bump: u8 (1)          -> byte 117
  
  for (const { pubkey, account } of accounts) {
    const data = account.data;
    if (data.length < 100) continue;
    
    console.log('=== Match ===');
    console.log('Pubkey:', pubkey.toBase58());
    
    const playerA = new PublicKey(data.slice(8, 40));
    console.log('Player A:', playerA.toBase58());
    
    const hasPlayerB = data[40] === 1;
    if (hasPlayerB) {
      const playerB = new PublicKey(data.slice(41, 73));
      console.log('Player B:', playerB.toBase58());
    } else {
      console.log('Player B: None (Open match)');
    }
    
    const stakeTier = data[73];
    console.log('Stake Tier:', stakeTier);
    
    const status = data[82];  // CORRECT offset!
    console.log('Status:', status === 0 ? 'Open' : status === 1 ? 'Active' : status === 2 ? 'Finished' : status === 3 ? 'Cancelled' : `Unknown(${status})`);
    
    const hasWinner = data[83] === 1;  // CORRECT offset!
    if (hasWinner) {
      const winner = new PublicKey(data.slice(84, 116));
      console.log('Winner:', winner.toBase58());
      console.log('Winner is Player A:', winner.equals(playerA));
    } else {
      console.log('Winner: NONE');
    }
    
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), pubkey.toBytes()],
      PROGRAM_ID
    );
    const escrowBalance = await connection.getBalance(escrowPda);
    console.log('Escrow Balance:', escrowBalance / 1e9, 'SOL');
    console.log('');
  }
}

main().catch(console.error);
