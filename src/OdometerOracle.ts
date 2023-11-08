import {
    Field,
    SmartContract,
    state,
    State,
    method,
    PublicKey,
    Signature,
  } from 'o1js';
  
  // The public key of our trusted data provider
  const ORACLE_PUBLIC_KEY =
    'B62qjxToGLu3bgpmdmNxmhdozJQDEAU4N26pWkWzjDsXbszwqjdaHMo';
  
  export class OdometerVerifier extends SmartContract {
    // Define contract state
    @state(PublicKey) oraclePublicKey = State<PublicKey>();


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