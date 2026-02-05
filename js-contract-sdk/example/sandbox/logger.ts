/* eslint-disable no-console */
import express, {Request, Response} from 'express'
import * as body from 'body-parser'

const app = express()

app.use(body.json())

app.post('/', (req: Request, res: Response) => {
  const [type, ...data] = req.body
  // @ts-ignore
  console[type || 'log'](...data)
  res.send('')
})

app.listen(5050, '0.0.0.0', () => {
  console.log('Logger is ready')
})
