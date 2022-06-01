import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers,Contract,utils } from "ethers"
import Head from "next/head"
import {useEffect, React, useState} from "react"
import styles from "../styles/Home.module.css"
import { useForm, SubmitHandler } from "react-hook-form";
import { object, string, number, date, InferType } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import TextField from "@mui/material/TextField";
let userSchema = object({
  name: string().required(),
  age: number().required().positive().integer(),
  address: string().required()
});

type Inputs = {
  name: string,
  age: number,
  address: string,
};

function ZKForm() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Inputs>({
  	resolver: yupResolver<yup.AnyObjectSchema>(userSchema)
  });
  const onSubmit: SubmitHandler<Inputs> = data => console.log(data);

  
  return (
    /* "handleSubmit" will validate your inputs before invoking "onSubmit" */
    <div>
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField id="outlined-basic" label="name" variant="outlined" autoComplete="off" {...register("name", { required: true })} /> 
      <TextField id="outlined-basic" label="age" variant="outlined" autoComplete="off" {...register("age", { required: true })} />
      <TextField id="outlined-basic" label="address" variant="outlined" autoComplete="off" {...register("address", { required: true })} />
      <input type="submit" />
    </form>
    </div>
  );
}
export default function Home() {
	const [greeting, setGreeting] = useState("");

	useEffect(async function(){
	//const provider = (await detectEthereumProvider()) as any;
	        //const ethers = new providers.Web3Provider(provider);
	        
	       	//provider.pollingInterval = 1000;
			const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)
			const filters = contract.filters.NewGreeting()
			const provider = new providers.JsonRpcProvider('http://localhost:8545/')
			const contractOwner = contract.connect(provider.getSigner())
			//console.log(ethers)
			//var str = web3.utils.hexToAscii(filters.topics[0])
			//console.log(str)
			contractOwner.on('NewGreeting', (greeting) => {
			        const message = utils.parseBytes32String(greeting)
			        setGreeting(message)
			})
		 
	},[])
    const [logs, setLogs] = useState("Connect your wallet and greet!")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <br/><br/>
                <textarea
                          placeholder="Waiting for a greeting"
                          value={greeting}
                          onChange={() => {}}
                          marginTop="10px"
                        />
                        <br/><br/>
                <ZKForm/>
            </main>
        </div>
    )
}
