import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  const slots = [
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947",
    "0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5",
    "0x4a204f938c5c7863afa1dcfcd5dec9d88b3f1911d3f2b84efac0b15671d2b0e6"
  ];
  
  for (const slot of slots) {
    const val = await ethers.provider.getStorage(vaultAddress, slot);
    console.log(`Slot ${slot}: ${val}`);
  }
}

main().catch(console.error);
