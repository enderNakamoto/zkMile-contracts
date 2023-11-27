import {
    SmartContract,
    Field,
    Struct,
    MerkleTree,
    state,
    State,
    method,
    DeployArgs,
    Signature,
    PublicKey,
    Permissions,
    Bool,
    Poseidon,
  } from 'o1js';
  
  import {
    OffChainStorage,
    MerkleWitness8,
  } from 'experimental-zkapp-offchain-storage';


  // The public key for storage server
  const STORAGE_SERVER_PUBLIC_KEY = 'B62qqJsBDaXND7Cg1XwNcwbzqP4Qe194Jwf9Q1E4eiqHUJNfKgenG9d'
  
  // The public key of our trusted data provider
  const ORACLE_PUBLIC_KEY =
    'B62qjxToGLu3bgpmdmNxmhdozJQDEAU4N26pWkWzjDsXbszwqjdaHMo';

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

export class OdometerContract extends SmartContract {
    // 7 slots , public key takes 2 slots each?? MAX 8 slots 
    @state(PublicKey) storageServerPublicKey = State<PublicKey>();
    @state(PublicKey) oraclePublicKey = State<PublicKey>();
    @state(Field) storageNumber = State<Field>();
    @state(Field) storageTreeRoot = State<Field>();
    @state(Field) totalMilesTracked = State<Field>();
  
    deploy(args: DeployArgs) {
        super.deploy(args);
        this.account.permissions.set({
          ...Permissions.default(),
          editState: Permissions.proofOrSignature(),
        });
    }

    @method initState() {
        this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
        this.storageServerPublicKey.set(PublicKey.fromBase58(STORAGE_SERVER_PUBLIC_KEY));
        this.storageNumber.set(Field(0));
        this.totalMilesTracked.set(Field(0));
        const emptyTreeRoot = new MerkleTree(8).getRoot();
        this.storageTreeRoot.set(emptyTreeRoot);
    }

    // @method updateMiles(
    //     car: Car, 
    //     path: MerkleWitness8, 
    //     odometer: Field,
    //     leafIsEmpty: Bool,
    //     storedNewRootNumber: Field,
    //     storedNewRootSignature: Signature
    // ){
    //     const storedRoot = this.storageTreeRoot.get();
    //     this.storageTreeRoot.assertEquals(storedRoot);
    
    //     let storedNumber = this.storageNumber.get();
    //     this.storageNumber.assertEquals(storedNumber);
    
    //     let storageServerPublicKey = this.storageServerPublicKey.get();
    //     this.storageServerPublicKey.assertEquals(storageServerPublicKey);
  
    //     // check to see if the car is in merkle tree
    //     const carRoot = path.calculateRoot(Poseidon.hash(Car.toFields(car)));
    //     carRoot.assertEquals(storedRoot);

    //     // car before calculation of miles
    //     let leaf = [Poseidon.hash(Car.toFields(car))];
        
    //     // calculate miles
    //     const milesToAdd = car.calculateMiles(odometer)

    //     // car after calculation of miles
    //     let newLeaf = [Poseidon.hash(Car.toFields(car))];

    //     // update total miles tracked 
    //     this.totalMilesTracked.set(this.totalMilesTracked.getAndAssertEquals().add(milesToAdd));

    //     // include udpated miles and update tree root
    //     const updates = [
    //       {
    //         leaf,
    //         leafIsEmpty,
    //         newLeaf,
    //         newLeafIsEmpty: Bool(false),
    //         leafWitness: path,
    //       },
    //     ];

    //     const storedNewRoot = OffChainStorage.assertRootUpdateValid(
    //       storageServerPublicKey,
    //       storedNumber,
    //       storedRoot,
    //       updates,
    //       storedNewRootNumber,
    //       storedNewRootSignature
    //     );

    //     this.storageTreeRoot.set(storedNewRoot);
    //     this.storageNumber.set(storedNewRootNumber);
    //   }
  
    @method verify(id: Field, odometer: Field, signature: Signature) {
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