import { OdometerVerifier } from './OdometerOracle';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'o1js';

let proofsEnabled = false;

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qjxToGLu3bgpmdmNxmhdozJQDEAU4N26pWkWzjDsXbszwqjdaHMo';

describe('OdometerVerifier', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: OdometerVerifier;

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
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
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

  });
});