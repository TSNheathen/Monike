const { checkStorageHealth, parsePortableDf } = require('../../pb_hooks/lib/monitoring.js')

describe('PocketBase Volume monitoring', () => {
  it('parsuje portable df výstup bez závislosti na názvu mountu', () => {
    expect(parsePortableDf(
      'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vdc 5242880 1048576 4194304 20% /pb/pb_data\n',
    )).toEqual({ availableBytes: 4_294_967_296, usedPercent: 20 })
  })

  it('odešle healthy výsledek jen pod 80 % a s alespoň 1 GB volného místa', () => {
    const removed = []
    const system = {
      stat: () => ({ isDir: () => true }),
      writeFile: () => {},
      remove: (name) => removed.push(name),
      cmd: () => ({
        output: () =>
          'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vdc 5242880 1048576 4194304 20% /pb/pb_data\n',
      }),
    }
    const result = checkStorageHealth({ dataDir: () => '/pb/pb_data' }, system)
    expect(result.healthy).toBe(true)
    expect(removed).toEqual(['/pb/pb_data/.monike-storage-write-probe'])
  })

  it.each([
    ['vysoké zaplnění', '524288 471859 52429 90%'],
    ['méně než 1 GB volného místa', '5242880 4500000 742880 75%'],
  ])('zastaví heartbeat pro %s', (_label, row) => {
    const result = checkStorageHealth(
      { dataDir: () => '/pb/pb_data' },
      {
        stat: () => ({ isDir: () => true }),
        writeFile: () => {},
        remove: () => {},
        cmd: () => ({ output: () => `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vdc ${row} /pb/pb_data\n` }),
      },
    )
    expect(result.healthy).toBe(false)
  })
})
