import {
  frodo as instance0,
  state as state0,
  FrodoLib,
  createInstanceWithAdminAccount,
  createInstanceWithServiceAccount,
} from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

const host0 = 'https://instance0/am';
const host1 = 'https://instance1/am';
const host2 = 'https://instance2/am';

describe('FrodoLib', () => {
  test(`FrodoLib(): FrodoLib is instantiable using factory function`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = FrodoLib({
      host: 'https://instance1/am',
    });
    const instance2 = FrodoLib({
      host: 'https://instance2/am',
    });
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance2.state.getHost()).toEqual(host2);
  });

  test(`createInstanceWithAdminAccount(): FrodoLib is instantiable using factory helper`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = createInstanceWithAdminAccount(
      'https://instance1/am',
      'admin1',
      'password1'
    );
    const instance2 = createInstanceWithAdminAccount(
      'https://instance2/am',
      'admin2',
      'password2'
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getUsername()).toEqual('admin1');
    expect(instance1.state.getPassword()).toEqual('password1');
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getUsername()).toEqual('admin2');
    expect(instance2.state.getPassword()).toEqual('password2');
  });

  test(`createInstanceWithServiceAccount(): FrodoLib is instantiable using factory helper`, async () => {
    state0.setHost('https://instance0/am');
    const instance1 = createInstanceWithServiceAccount(
      'https://instance1/am',
      'serviceAccount1',
      '{"k":"jwk1"}'
    );
    const instance2 = createInstanceWithServiceAccount(
      'https://instance2/am',
      'serviceAccount2',
      '{"k":"jwk2"}'
    );
    expect(instance0.state.getHost()).toEqual(host0);
    expect(instance1.state.getHost()).toEqual(host1);
    expect(instance1.state.getServiceAccountId()).toEqual('serviceAccount1');
    expect(instance1.state.getServiceAccountJwk()).toMatchObject(
      JSON.parse('{"k":"jwk1"}')
    );
    expect(instance2.state.getHost()).toEqual(host2);
    expect(instance2.state.getServiceAccountId()).toEqual('serviceAccount2');
    expect(instance2.state.getServiceAccountJwk()).toMatchObject(
      JSON.parse('{"k":"jwk2"}')
    );
  });
});
