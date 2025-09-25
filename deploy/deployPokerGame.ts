import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying PokerGame contract...");

  const pokerGame = await deploy("PokerGame", {
    from: deployer,
    args: [], // No constructor arguments needed
    log: true,
    autoMine: true, // speed up deployment on local network
  });

  console.log(`PokerGame contract deployed at: ${pokerGame.address}`);

  // Verify the contract on Etherscan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: pokerGame.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Error verifying contract:", error);
    }
  }
};

export default func;
func.tags = ["PokerGame"];