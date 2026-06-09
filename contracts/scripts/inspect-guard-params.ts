import { ethers } from "hardhat";

async function main() {
  const guardAddress = "0x666Bc822156824F40F2b70aAaAcBfe87467D79A5";
  
  const abi = [
    "function policyRegistry() external view returns (address)",
    "function trustedModule() external view returns (address)",
    "function trustedSafeModule() external view returns (address)"
  ];
  
  const guard = new ethers.Contract(guardAddress, abi, ethers.provider);
  try {
    const registry = await guard.policyRegistry();
    console.log("Guard policyRegistry:", registry);
  } catch (e: any) {
    console.error("policyRegistry failed:", e.message || e);
  }
  
  try {
    const tm = await guard.trustedModule();
    console.log("Guard trustedModule:", tm);
  } catch (e: any) {
    console.error("trustedModule failed:", e.message || e);
  }
  
  try {
    const tsm = await guard.trustedSafeModule();
    console.log("Guard trustedSafeModule:", tsm);
  } catch (e: any) {
    console.error("trustedSafeModule failed:", e.message || e);
  }
}

main().catch(console.error);
