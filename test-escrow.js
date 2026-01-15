const { Connection, PublicKey, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');
const { Program, AnchorProvider, web3 } = require('@coral-xyz/anchor');
const fs = require('fs');

const PROGRAM_ID = new PublicKey('H1Sn4JQvsZFx7HreZaQn4Poa3hkoS9iGnTwrtN2knrKV');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Load IDL
const idl = JSON.parse(fs.readFileSync('./utils/sol_mate_escrow.json', 'utf8'));

async function testProgram() {
  console.log('Testing escrow program on devnet...');
  console.log('Program ID:', PROGRAM_ID.toString());
  
  // Check if program exists
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    console.log('❌ Program not found on devnet');
    return;
  }
  
  console.log('✅ Program exists on devnet');
  console.log('Program size:', programInfo.data.length, 'bytes');
  console.log('\n📋 IDL Instructions:');
  idl.instructions.forEach(ix => {
    console.log(`  - ${ix.name}`);
  });
  
  console.log('\n✅ Basic validation passed');
  console.log('\n🔍 To fully test, connect wallet and try creating a match on the website');
}

testProgram().catch(console.error);
