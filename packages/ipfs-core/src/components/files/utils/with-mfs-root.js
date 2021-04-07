'use strict'

const { CID } = require('multiformats/cid')
const { UnixFS } = require('ipfs-unixfs')
// @ts-ignore
const dagPb = require('@ipld/dag-pb')
const { sha256 } = require('multiformats/hashes/sha2')
const Block = require('multiformats/block')
// @ts-ignore
const log = require('debug')('ipfs:mfs:utils:with-mfs-root')
const errCode = require('err-code')

const {
  MFS_ROOT_KEY
} = require('../../../utils')

/**
 * @typedef {import('../').MfsContext} MfsContext
 */

/**
 * @param {MfsContext} context
 * @param {import('ipfs-core-types/src/utils').AbortOptions} [options]
 */
const loadMfsRoot = async (context, options) => {
  if (options && options.signal && options.signal.aborted) {
    throw errCode(new Error('Request aborted'), 'ERR_ABORTED', { name: 'Aborted' })
  }

  // Open the repo if it's been closed
  await context.repo.datastore.open()

  // Load the MFS root CID
  let cid

  try {
    const buf = await context.repo.datastore.get(MFS_ROOT_KEY)

    cid = CID.decode(buf)
  } catch (err) {
    if (err.code !== 'ERR_NOT_FOUND') {
      throw err
    }

    log('Creating new MFS root')
    const node = dagPb.prepare({ Data: new UnixFS({ type: 'directory' }).marshal() })
    const block = await Block.encode({
      value: node,
      codec: dagPb,
      hasher: sha256
    })
    cid = block.cid.toV0()
    await context.blockStorage.put(block)

    if (options && options.signal && options.signal.aborted) {
      throw errCode(new Error('Request aborted'), 'ERR_ABORTED', { name: 'Aborted' })
    }

    await context.repo.datastore.put(MFS_ROOT_KEY, cid.bytes)
  }

  log(`Loaded MFS root /ipfs/${cid}`)

  return cid
}

module.exports = loadMfsRoot
