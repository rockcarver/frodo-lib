import { frodo as instance0, state as state0, FrodoLib } from '../index';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

const host0 = 'https://instance0/am';
const host1 = 'https://instance1/am';
const host2 = 'https://instance2/am';

describe('FrodoLib', () => {
  test(`FrodoLib is instantiable`, async () => {
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
});
