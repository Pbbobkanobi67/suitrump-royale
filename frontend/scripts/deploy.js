import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🎰 Deploying BlueRaffleBlockhash...\n');

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'BNB\n');

  // Configuration
  const BLUE_TOKEN = process.env.BLUE_TOKEN || '0xf11Af396703E11D48780B5154E52Fd7b430C6C01';
  const TREASURY_WALLET = process.env.TREASURY_WALLET || deployer.address;
  const DEVELOPER_WALLET = process.env.DEVELOPER_WALLET || deployer.address;

  console.log('Configuration:');
  console.log('  BLUE Token:', BLUE_TOKEN);
  console.log('  Treasury:', TREASURY_WALLET);
  console.log('  Developer:', DEVELOPER_WALLET);
  console.log('');

  // Deploy contract
  console.log('Deploying contract...');
  const BlueRaffle = await ethers.getContractFactory('BlueRaffleBlockhash');
  const raffle = await BlueRaffle.deploy(
    BLUE_TOKEN,
    TREASURY_WALLET,
    DEVELOPER_WALLET
  );

  await raffle.waitForDeployment();
  const raffleAddress = await raffle.getAddress();

  console.log('✅ BlueRaffleBlockhash deployed to:', raffleAddress);
  console.log('');

  // Get initial round info
  const roundInfo = await raffle.getCurrentRoundInfo();
  console.log('Initial Round Info:');
  console.log('  Round ID:', roundInfo.roundId.toString());
  console.log('  Status:', ['Waiting', 'Active', 'Drawing', 'Complete', 'Cancelled'][roundInfo.status]);
  console.log('  Min Tickets:', ethers.formatEther(await raffle.minTickets()), 'BLUE');
  console.log('  Max Tickets:', ethers.formatEther(await raffle.maxTickets()), 'BLUE');
  console.log('  Round Duration:', (await raffle.roundDuration()).toString(), 'seconds');
  console.log('');

  // Export ABI and address for frontend
  const contractData = {
    address: raffleAddress,
    network: 'bsc_testnet',
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // Save to frontend config
  const frontendDir = path.join(__dirname, '..', 'frontend', 'src', 'config');
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendDir, 'contract.json'),
    JSON.stringify(contractData, null, 2)
  );

  // Copy ABI
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'BlueRaffleBlockhash.sol', 'BlueRaffleBlockhash.json');
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    fs.writeFileSync(
      path.join(frontendDir, 'abi.json'),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log('✅ Contract ABI exported to frontend/src/config/abi.json');
  }

  console.log('✅ Contract address exported to frontend/src/config/contract.json');
  console.log('');

  // Verification instructions
  console.log('📝 To verify on BscScan:');
  console.log(`npx hardhat verify --network bsc_testnet ${raffleAddress} "${BLUE_TOKEN}" "${TREASURY_WALLET}" "${DEVELOPER_WALLET}"`);
  console.log('');

  console.log('🎉 Deployment complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Start frontend: cd frontend && npm run dev');
  console.log('2. Test with two wallets buying tickets');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
