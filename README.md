# Mina zkApp: Zkmile Contracts

## What are we building?

Developers and Tesla owners have been getting car data through unofficial API for years, however on October 2023, Tesla finally launched official API for developers to create third party apps on their platform. 

This project is an exploration to see if we can bring Tesla's drive state and vehicle state on-chain privately. We are building an hypothetical on-chain insurance protocol based on tesla api data without compromising privacy. 

There are many challenges to solve: 

1. A trusted setup(oracle) to get Tesla data for on-chain contracts

2. We want the insurance protocol to only insure new cars, therefore we need to check the odometer value without exposing the exact odometer value 

3. We also want the insurance protocol to have a variable price based on miles driven per month, and therefore we need to check for it every month, and apply discounts accordingly

4. The Tesla API also exposes the `drive_state` that allows us to get lat/long values of the current heading and speed of the car, we can therefore check for the speeding habits of the driver without exposing location details of the car 

Having access to odometer, speed and location data will allow insurance protocol to calculate counterparty risk for individual Teslas. Moreover, using Mina, we can do so privately and with scale. 

## Implementation details 

Since this is the first attempt at ZK programming for the wuthor, and due to constraints of time of the Mina Navigator program, the contracts only deal with odometer values, and does not include implementation with lot/lon yet. Those will be implemented in the future. 

We did not have access to a Tesla, so we mocked the Tesla API data based on Tesla docs with a NextJs Api endpoint app hosted on vercel. Getting realtime data from Tesla will also be implemented in the future.

We add a generate public key and a signature with the data, so that it can be verified that the data is coming from a trusted source by the contract. The public/private key for the scheme has was generated using the `mina-signer` npm package. We also use the `faker` npm package to generate mock Tesla `vehicle_data` and `drive_state` as per API specifications of official Tesla website. 

For the first challenge, we are checking that the odometer reading is not over 8000. Since the call to the contract is done of user's device, the data (odometer reading in this case) is private and we do not store that in the contract state. We simply check if it is over or below 8000 and emit an event accordingly. 

For the second challenge, we need to calculate the miles driven at the nd of every month, and for this, we will need to store the odometer value at the end of the last month. This contradicts with our desire to keep the odometer valye private. Hence, we use partial homomorphic encryption to shield this value. We use `o1js-egaml` package for this. 

We also want to scale this protocol, and for this we use a Merkle Tree. For the proof of concept we use a tree of height 4. There, it can track the state of 2^4 = 16 cars, however this can be easily scaled. We use a Struct to model data needed for the car and store in the merkle tree leaves. 

The entire cpntract only needs to store two states: The public key to verify the signature of the oracle and the merkle tree root. 

![image](https://github.com/enderNakamoto/zkMile-contracts/assets/68520496/0ebe4045-4455-4c92-bb9b-daf33e303777)


## How to run tests

We also included tests for the contract, to run the test simply use the following command: 

```sh
npm run test
```

## License

[Apache-2.0](LICENSE)

---

## Record of Time Allocated to Research Activities

---

### November 9th - Exploring ElGamal Encryption

Investigated incorporating odometer readings into a Merkle Tree leaf while maintaining privacy. Explored homomorphic encryption as a solution, referencing Florian's implementation ([ElGamal implementation](https://github.com/Trivo25/o1js-elgamal)). The library usage is straightforward, yet it fails to address my specific need.

**Unresolved Issue:**
Both the `ElGamalECC` and `ElGamalFF` versions are available, but neither supports subtraction, which is crucial for my application.

---

### November 25th - OffChain Merkle Tree Storage Implementation

The implementation process was direct, but I encountered an obstacle. It might be an error on my part.

**Unresolved Issue:**
Struggling to store the Poseidon Hash of a Struct in a Merkle Tree leaf.

**Potential Contribution Opportunity:**
Developing a Redis-based offchain storage solution accessible to zkApp users.

---

### November 26th - Calculating Distance Between Coordinates (Latitude, Longitude)

Faced challenges in converting decimal values to Field, hindering the use of the Haversine formula for distance calculation. Discovered a relevant implementation in SnarkyJs ([SnarkyJs math](https://github.com/yunus433/snarkyjs-math)) and a related discussion ([SnarkyJs discussion](https://discord.com/channels/484437221055922177/1163471192158634075)). This implementation, however, needs updating to O1js.

**Potential Contribution Opportunity:**
Updating the SnarkyJs math library to O1js standards.

---

### November 27th - Basic Experimentation of Mina Native Tokens

Used Tutorial to mint basic tokens and understand how mina native tokens work. Also looked ta Mina Token API to see what is possible. 

Next research - look at example ([DEX](https://github.com/o1-labs/o1js/tree/main/src/examples/zkapps/dex)) to see how an ZkApp can interact with a Mina Native Token

---

### November 28th - Basic Experimentation with Recursion 

Ran through tutorial to learn about basic recursion wiyth O1js, struggled a bit with O1 js versions. 

Also, submitted pull request for an issue I came across in the tutorial
https://github.com/o1-labs/docs2/pull/764