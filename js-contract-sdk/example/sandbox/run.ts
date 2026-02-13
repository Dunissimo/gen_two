/* eslint-disable no-console */
import { exec } from 'child_process'
import { NetworkInterfaceInfo, networkInterfaces } from 'os'
import { broadcast, getContractDeveloper, getParticipants, sleep } from './utils'
import { CallContractTx, CreateContractTx } from '@wavesenterprise/voting-blockchain-tools/transactions'
import { CONTRACT_NAME, NODE_ADDRESS, NODE_KEYPAIR_PASSWORD } from './config'
import * as path from 'path'
import { WaitTransactionMining } from '@wavesenterprise/voting-contract-api'
import axios from 'axios'
import { writeFileSync } from 'fs'


const contractName = CONTRACT_NAME.toLowerCase()

function getLocalHostNetworkIp() {
  const network = networkInterfaces()
  for (const key in network) {
    for (const net of (network[key] as NetworkInterfaceInfo[])) {
      if (net.address.includes('192.168.')) {
        return net.address
      }
    }
  }
  throw new Error('Local network ip was not found')
}

const imageName = `localhost:5000/${contractName}`
const ip = getLocalHostNetworkIp()

const execute = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout) => {
      if (err) {
        reject(err)
      } else {
        resolve(stdout)
      }
    })
  })
}

const run = async () => {
  console.log('Building sdk')
  await execute(`npm --prefix ${path.resolve(__dirname, '..', '..', 'packages', 'contract-core')} run build`)
  console.log(`Building docker image, debug=1, host_network=${ip}`)
  const buildCommand =
    // eslint-disable-next-line max-len
    `docker build --build-arg DEBUG=1 --build-arg REMOTE_LOG=1 --build-arg HOST_NETWORK=${ip} -t ${contractName} -f sandbox.Dockerfile ../../`
  console.log(buildCommand)
  await execute(buildCommand)
  console.log('Done building')
  await execute(`docker image tag ${contractName} ${imageName}`)
  console.log('Tagged')
  console.log(`Start pushing to repo ${imageName}`)
  await execute(`docker push ${imageName}`)
  console.log('Done pushing')
  const inspectResult = await execute(`docker inspect ${imageName}`)
  const inspectData = JSON.parse(inspectResult)[0]
  const imageHash = inspectData.Id.replace('sha256:', '')
  console.log(`New image hash is ${imageHash}`)

  const developerKeys = await getContractDeveloper()
  const result = await broadcast(new CreateContractTx({
    contractName: CONTRACT_NAME,
    image: imageName,
    imageHash,
    fee: 0,
    senderPublicKey: developerKeys.publicKey,
    apiVersion: '1.0',
    validationPolicy: {
      type: 'any',
    },
    params: [],
    payments: [],
  }), developerKeys)

  console.log(`Contract id ${result.id}`)

  const waiter = new WaitTransactionMining(
    NODE_ADDRESS,
    axios,
    100000,
    0,
    result.id,
  )

  console.log('Waiting create contract mining')
  await waiter.waitMining()
  console.log('Create tx mined')

  let toSet:string[] = []
  const participants = await getParticipants()
  for (let i = 0; i < 50; i++) {
    toSet.push(participants[i].publicKey)
  }

  console.log('Parts: ', toSet);
  
  const result2 = await broadcast(new CallContractTx({
    contractId: result.id,
    contractVersion: 1,
    fee: 0,
    senderPublicKey: developerKeys.publicKey,
    params: [
      {
        key: 'action',
        type: 'string',
        value: 'init'
      }
    ],
    payments: [],
  }), developerKeys)
  
  console.log('All tx`s sent')

  const data = {
    NODE_ADDRESS: NODE_ADDRESS,
    NODE_KEY: NODE_KEYPAIR_PASSWORD,
    CONTRACT_ID: result.id
  }

  writeFileSync("../../../frontend/config.json", JSON.stringify(data, null, 2));
}

run().catch(console.error)
