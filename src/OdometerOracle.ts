import {
    Field,
    SmartContract,
    state,
    State,
    method,
    PublicKey,
    Signature,
    Struct, 
    MerkleWitness, 
    Poseidon
  } from 'o1js';
  
  // The public key of our trusted data provider
  const ORACLE_PUBLIC_KEY =
    'B62qjxToGLu3bgpmdmNxmhdozJQDEAU4N26pWkWzjDsXbszwqjdaHMo';

  // adding the ability to track mileage of 2^4 = 16 cars
  export const treeHeight = 4;
  export class MerkleWitness4 extends MerkleWitness(treeHeight) {}

  export class Car extends Struct({
    carId: Field,
    lastOdometer: Field,
    timestamp: Field,
    milesLastMonth: Field
  }){
    calculateMiles(odometer: Field){
      this.milesLastMonth = odometer.sub(this.lastOdometer)
      this.lastOdometer = odometer
      this.timestamp = Field(Date.now())
    };
  }

  
  export class OdometerVerifier extends SmartContract {
    // Define contract state
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) treeRoot = State<Field>();

    // Define contract events
    events = {
        verified: Field,
    };
      
      
    init() {
        super.init();
        // Initialize contract state
        this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
        // Specify that caller should include signature with tx instead of proof
        this.requireSignature();
    }
  
    @method initMerkleTree(initialRoot: Field){
      this.treeRoot.set(initialRoot);
    }

    @method updateMiles(car: Car, path: MerkleWitness4, odometer: Field){
      // get the tree root 
      const treeRoot = this.treeRoot.getAndAssertEquals();

      // check to see if the car is in merkle tree
      const carRoot = path.calculateRoot(Poseidon.hash(Car.toFields(car)));
      carRoot.assertEquals(treeRoot);

      // calculate miles
      car.calculateMiles(odometer)

      // include udpated miles and update tree root
      const newCarRoot = path.calculateRoot(Poseidon.hash(Car.toFields(car)));
      this.treeRoot.set(newCarRoot);
    }


    @method verify(id: Field, odometer: Field, signature: Signature) {
      // Get the oracle public key from the contract state
        const oraclePublicKey = this.oraclePublicKey.get();
        this.oraclePublicKey.assertEquals(oraclePublicKey);
        
      // Evaluate whether the signature is valid for the provided data
      const validSignature = signature.verify(oraclePublicKey, [id, odometer]);


      // Check that the signature is valid
      validSignature.assertTrue();

      // Check that the provided credit score is less than 8000
      odometer.assertLessThanOrEqual(Field(8000));

      // Emit an event containing the verified vehicle id
      this.emitEvent('verified', id);

    }
  }