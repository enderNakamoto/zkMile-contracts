import { OdometerVerifier, treeHeight, Car, MerkleWitness4 } from './OdometerOracle';

import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
  MerkleTree, 
  CircuitString, 
  Poseidon
} from 'o1js';


let proofsEnabled = false;

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qjxToGLu3bgpmdmNxmhdozJQDEAU4N26pWkWzjDsXbszwqjdaHMo';


  function createCar(carId: string, lastOdometer: Field){
    const car = new Car(
      {
        carId: Poseidon.hash(CircuitString.fromString(carId).toFields()), 
        lastOdometer: lastOdometer,
        milesLastMonth: Field(0)
      });
  
    return car;
  }

  function createTree(): any {
    const tree = new MerkleTree(treeHeight);
  
    const car0 = createCar("21",Field(100));
    const car1 = createCar("42",Field(400));
    const car2 = createCar("34",Field(500));
    const car3 = createCar("45",Field(600));
    const car4 = createCar("58",Field(900));
  
  
    tree.setLeaf(0n, Poseidon.hash(Car.toFields(car0)));
    tree.setLeaf(1n, Poseidon.hash(Car.toFields(car1)));
    tree.setLeaf(2n, Poseidon.hash(Car.toFields(car2)));
    tree.setLeaf(3n, Poseidon.hash(Car.toFields(car3)));
    tree.setLeaf(4n, Poseidon.hash(Car.toFields(car4)));
    return tree;
  }  

describe('OdometerVerifier', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: OdometerVerifier,
    tree: MerkleTree;

  beforeAll(async () => {
    if (proofsEnabled) await OdometerVerifier.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new OdometerVerifier(zkAppAddress);
    tree = createTree();
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
      zkApp.initMerkleTree(tree.getRoot());
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `OdometerVerifier` smart contract', async () => {
    await localDeploy();
    const oraclePublicKey = zkApp.oraclePublicKey.get();
    expect(oraclePublicKey).toEqual(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  });

  it('initializes the Merkle Root', async() => {
    await localDeploy();
    const treeRoot = zkApp.treeRoot.get();
    expect(treeRoot).toEqual(tree.getRoot());
  });

  it('car miles per month are calculated properly', async () => {
    const car32 = createCar("32",Field(100));
    expect(car32.lastOdometer).toEqual(Field(100));

    // update with new odometer value of 500
    car32.calculateMiles(Field(500));
    expect(car32.milesLastMonth).toEqual(Field(400));
    expect(car32.lastOdometer).toEqual(Field(500));

  });

  describe('hardcoded values', () => {
    it('emits an `id` event containing the users id if their odometer reading is below 8000 and the provided signature is valid', async () => {
      await localDeploy();

      const id = Field(4);
      const odometer = Field(4680);
      const signature = Signature.fromBase58(
        '7mXS3yAGHddQBu3NpLooyRLtYsTo8vzainHMJAsVPbFWwZxjXVDkwjegnbdd2PgVCyxD5odRHADbsTQ2XYY6cBa2oFGraJq2'
      );

      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.verify(id, odometer, signature);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();

      const events = await zkApp.fetchEvents();
      const verifiedEventValue = events[0].event.data.toFields(null)[0];
      expect(verifiedEventValue).toEqual(id);
    });

    it('throws an error if the odometer reading is above 8000 even if the provided signature is valid', async () => {
      await localDeploy();

      const id = Field(2);
      const odometer = Field(65832);
      const signature = Signature.fromBase58(
        '7mXWHLaN3dEVgaGVFxHvFGREMbGqtVznNS4TqxmVJ6vcJwgGsqETikyRahw2EJhLreuvKHupfLzfoUoS7bK75a27qMWJP1Sn'
      );

      expect(async () => {
        const txn = await Mina.transaction(senderAccount, () => {
          zkApp.verify(id, odometer, signature);
        });
      }).rejects;
    });

    it('throws an error if the odometer reading is below 8000 and the provided signature is invalid', async () => {
      await localDeploy();

      const id = Field(2);
      const odometer = Field(5612);
      const signature = Signature.fromBase58(
        '7mXWHLaN3dEVgaGVFxHvFGREMbGqtVznNS4TqxmVJ6vcJwgGsqETikyRahw2EJhLreuvKHupfLzfoUoS7bK75a27qMWJP1Sn'
      );

      expect(async () => {
        const txn = await Mina.transaction(senderAccount, () => {
          zkApp.verify(id, odometer, signature);
        });
      }).rejects;
    });
  });

  describe('actual API requests', () => {
    it('emits an `id` event containing the vehicle id if their odometer reading is below 8000 and the provided signature is valid', async () => {
      await localDeploy();

      const response = await fetch(
        'https://zk-mile-enders-projects.vercel.app/api/vehicle_data?id=4'
      );
      const data = await response.json();

      const id = Field(data.vehicle_data.id);
      const odometer = Field(data.vehicle_data.vehicle_state.odometer);
      const signature = Signature.fromBase58(data.signature);

      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.verify(id, odometer, signature);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();

      const events = await zkApp.fetchEvents();
      const verifiedEventValue = events[0].event.data.toFields(null)[0];
      expect(verifiedEventValue).toEqual(id);
    });

    it('throws an error if the vehicle id if their odometer reading is above 8000 even if the provided signature is valid', async () => {
      await localDeploy();

      const response = await fetch(
        'https://zk-mile-enders-projects.vercel.app/api/vehicle_data?id=2'
      );
      const data = await response.json();

      const id = Field(data.vehicle_data.id);
      const odometer = Field(data.vehicle_data.vehicle_state.odometer);
      const signature = Signature.fromBase58(data.signature);

      expect(async () => {
        const txn = await Mina.transaction(senderAccount, () => {
          zkApp.verify(id, odometer, signature);
        });
      }).rejects;
    });


    it('correctly calculates miles for a car, total miles is tracked, and tree root changes correctly', async () => {
      await localDeploy();
  
      const car2 = createCar("34",Field(500));
      const path = new MerkleWitness4(tree.getWitness(2n));
  
      // update transaction
      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.updateMiles(car2, path, Field(800));
      });
      await txn.prove();
      await txn.sign([senderKey]).send();
      
      // this should be 300 (800 - 500) 
      const totalMilesTracked = zkApp.totalMilesTracked.get();
      expect(totalMilesTracked).toEqual(Field(300));
  
      // change tree root manually and then compare the roots
      car2.calculateMiles(Field(800));
      tree.setLeaf(2n, Poseidon.hash(Car.toFields(car2)));
      const treeRoot = zkApp.treeRoot.get();
      expect(treeRoot).toEqual(tree.getRoot());
    });


    it('does not calculate miles for car that is not in the tree', async () => {
      await localDeploy();
  
      const car1 = createCar("69",Field(690))
      const path = new MerkleWitness4(tree.getWitness(1n));
  
      // update transaction
      let calculated = false;
      try{
        const txn = await Mina.transaction(senderAccount, () => {
          zkApp.updateMiles(car1, path, Field(1000));
        });
        await txn.prove();
        await txn.sign([senderKey]).send();
        calculated = true
  
      }catch(e){}
      expect(calculated).toEqual(false);
  
    });

  });
});