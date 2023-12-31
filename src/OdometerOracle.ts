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
    milesLastMonth: Field
  }){
    calculateMiles(odometer: Field){
      this.milesLastMonth = odometer.sub(this.lastOdometer)
      this.lastOdometer = odometer
      return this.milesLastMonth
    };
  }

  
  export class OdometerVerifier extends SmartContract {
    // Define contract state
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) treeRoot = State<Field>();
    @state(Field) totalMilesTracked = State<Field>();

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
      const milesToAdd = car.calculateMiles(odometer)

      // update total miles tracked 
      this.totalMilesTracked.set(this.totalMilesTracked.getAndAssertEquals().add(milesToAdd));

      // include udpated miles and update tree root
      const newCarRoot = path.calculateRoot(Poseidon.hash(Car.toFields(car)));
      this.treeRoot.set(newCarRoot);
    }


    @method verifyDistance(
      id: Field, 
      latitude: Field, 
      longitude: Field,
      odometer: Field,
      signature: Signature)
    {
      // Get the oracle public key from the contract state
      const oraclePublicKey = this.oraclePublicKey.get();
      this.oraclePublicKey.assertEquals(oraclePublicKey);

      // Evaluate whether the signature is valid for the provided data
      const validSignature = signature.verify(oraclePublicKey, [id, odometer]);

      // Check that the signature is valid
      validSignature.assertTrue();

      // !! Research!! 
      // Ran into two issues here 
      // Trying to calculate distance between two co-ordinates (lat, lon)
      // Decimal to Field is not well talked about in Mina docs 
      // Found the library - https://github.com/yunus433/snarkyjs-math
      // This needs to be converted to O1js from snarkyjs implementation 
      // looking for alternate methods, 
      //perhaps this can be taken care of by a Google API call 
      // Then we trust Google 

    }

    @method verifyOdometer(id: Field, odometer: Field, signature: Signature) {
      // Get the oracle public key from the contract state
        const oraclePublicKey = this.oraclePublicKey.get();
        this.oraclePublicKey.assertEquals(oraclePublicKey);
        
      // Evaluate whether the signature is valid for the provided data
      const validSignature = signature.verify(oraclePublicKey, [id, odometer]);


      // Check that the signature is valid
      validSignature.assertTrue();

      // Check that the provided odometer value is less than 8000
      odometer.assertLessThanOrEqual(Field(8000));

      // Emit an event containing the verified vehicle id
      this.emitEvent('verified', id);

    }
  }