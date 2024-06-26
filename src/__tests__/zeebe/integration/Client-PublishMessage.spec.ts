import { v4 as uuid } from 'uuid'

import { restoreZeebeLogging, suppressZeebeLogging } from '../../../lib'
import { ZeebeGrpcClient } from '../../../zeebe'
import { cancelProcesses } from '../../../zeebe/lib/cancelProcesses'

jest.setTimeout(45000)
suppressZeebeLogging()

const zbc = new ZeebeGrpcClient()
let processDefinitionKey: string

beforeAll(
	async () =>
		({ processDefinitionKey } = (
			await zbc.deployResource({
				processFilename: './src/__tests__/testdata/Client-MessageStart.bpmn',
			})
		).deployments[0].process)
)

afterAll(async () => {
	await zbc.close()
	restoreZeebeLogging()
	await cancelProcesses(processDefinitionKey)
})

test('Can publish a message', () =>
	new Promise((done) => {
		const randomId = uuid()

		// Wait 1 second to make sure the deployment is complete
		new Promise((res) => setTimeout(() => res(null), 1000)).then(() => {
			zbc.publishMessage({
				name: 'MSG-START_JOB',
				variables: {
					testKey: randomId,
				},
				correlationKey: 'something',
			})

			zbc.createWorker({
				taskType: 'console-log-msg-start',
				taskHandler: async (job) => {
					const res = await job.complete()
					expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
					done(null)
					return res
				},
				loglevel: 'NONE',
			})
		})
	}))
