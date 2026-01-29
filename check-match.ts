import { Connection, PublicKey } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const MATCH_PDA = new PublicKey('8SyYMyJwNo41jirqu1FCY4K4ZU3sg9hRUpJhQ2CP5ECm');
const ESCROW_PDA = new PublicKey('7PHdmvsdBhLd4ouUqF31ij2at1aCgMeaYXK4Ba1UT5Ac');

const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=7ca044d7-5942-4ace-a0d1-e874a6515ba8');

async function check() {
  const matchInfo = await connection.getAccountInfo(MATCH_PDA);
  const escrowInfo = await connection.getAccountInfo(ESCROW_PDA);
  
  console.log('Match account exists:', !!matchInfo);
  if (matchInfo) {
    console.log('Match lamports:', matchInfo.lamports);
    console.log('Match owner:', matchInfo.owner.toBase58());
  }
  
  console.log('\nEscrow account exists:', !!escrowInfo);
  if (escrowInfo) {
    console.log('Escrow lamports:', escrowInfo.lamports);
    console.log('Escrow balance:', escrowInfo.lamports / 1e9, 'SOL');
  }
  
  // Also check wallet balance
  const WALLET = new PublicKey('9fNSVxsrju6YjkBSp7LqR9pPXJSZv34s4VevFaBuFtv');
  const balance = await connection.getBalance(WALLET);
  console.log('\nYour wallet balance:', balance / 1e9, 'SOL');
}

check().catch(console.error);
