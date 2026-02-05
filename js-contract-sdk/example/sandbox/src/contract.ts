import {
  Action,
  Assets,
  AssetsService,
  Contract,
  ContractMapping,
  ContractValue,
  IncomingTx,
  JsonVar,
  logger,
  Param,
  Params,
  preload,
  Tx,
  Var,
} from '@wavesenterprise/contract-core'

type User = {
  name: string
  address: string
  balance: number
  role: 'user' | 'employee' | 'admin'
  homeAddress?: string
  officeId?: string
}

type Shipment = {
  trackNumber: string     // RR2509202025347901346783
  sender: string          // Адрес отправителя
  recipient: string       // Адрес получателя
  type: 'letter' | 'parcel' | 'package'
  class: 1 | 2 | 3       // Класс доставки
  deliveryDeadline: number // timestamp
  deliveryCost: number    // СО (стоимость доставки)
  weight: number          // Вес кг (макс 10)
  declaredValue: number   // ОЦ (объявленная ценность)
  totalCost: number       // ИСО = СО*В + ОЦ*0.1
  fromAddress: string
  toAddress: string
  status: 'created' | 'in_transit' | 'delivered' | 'refused'
  history: Array<{ // История перемещений
    timestamp: number
    officeId: string
    employee: string
  }>
}

type MoneyTransfer = {
  id: string
  sender: string
  recipient: string
  amount: number
  lifetime: number // seconds
  status: 'pending' | 'accepted' | 'refused' | 'cancelled'
  createdAt: number
}

@Contract()
export default class PostalServiceContract {

  log = logger(this)

  @Var({ key: 'ADMIN_COUNT' })
  adminCount!: ContractValue<number>

  @Var({ key: 'USER_COUNT' })
  userCount!: ContractValue<number>

  @Var({ key: 'SHIPMENT_COUNT' })
  shipmentCount!: ContractValue<number>

  @Var({ key: 'TRANSFER_COUNT' })
  transferCount!: ContractValue<number>

  @JsonVar({ key: 'USERS' })
  users!: ContractMapping<User>

  @JsonVar({ key: 'SHIPMENTS' })
  shipments!: ContractMapping<Shipment>

  @JsonVar({ key: 'TRANSFERS' })
  transfers!: ContractMapping<MoneyTransfer>

  @Assets()
  assets!: AssetsService

  @Action({ onInit: true })
  async init(@Params() params: Record<string, unknown>) {
    // Initialize counters
    this.adminCount.set(1)
    this.userCount.set(4)
    this.shipmentCount.set(0)
    this.transferCount.set(0)

    // Predefined users
    const adminAddress = '3N...admin...' // Replace with actual addresses
    const rostovEmployee = '3N...rostov...'
    const taganrogEmployee = '3N...taganrog...'
    const regularUser = '3N...user...'

    // Admin
    this.users.set(adminAddress, {
      name: 'Семенов Семен Семенович',
      address: adminAddress,
      balance: 50,
      role: 'admin',
      homeAddress: 'г.Ростов-на-Дону, ул.Ленина, 1'
    })

    // Rostov employee
    this.users.set(rostovEmployee, {
      name: 'Петров Петр Петрович',
      address: rostovEmployee,
      balance: 50,
      role: 'employee',
      homeAddress: 'г.Ростов-на-Дону, ул.Социалистическая, 50',
      officeId: 'RR344000'
    })

    // Tagonrog employee
    this.users.set(taganrogEmployee, {
      name: 'Антонов Антон Антонович',
      address: taganrogEmployee,
      balance: 50,
      role: 'employee',
      homeAddress: 'г.Таганрог, ул.Петрова, 10',
      officeId: 'RR347900'
    })

    // Regular user
    this.users.set(regularUser, {
      name: 'Юрьев Юрий Юрьевич',
      address: regularUser,
      balance: 50,
      role: 'user',
      homeAddress: 'г.Ростов-на-Дону, ул.Пушкина, 25'
    })

    this.log.info('Postal service initialized with predefined users')
  }

  @Action()
  async register(@Tx() tx: IncomingTx, @Param('name') name: string, @Param('homeAddress') homeAddress: string) {
    const sender = tx.sender
    await preload(this, ['users'])
    
    if (await this.users.tryGet(sender)) {
      throw new Error('User already registered')
    }

    this.users.set(sender, {
      name,
      address: sender,
      balance: 0,
      role: 'user',
      homeAddress
    })
    
    this.userCount.set((await this.userCount.get()) + 1)
    this.log.info(`New user registered: ${name}`)
  }

  @Action()
  async updateProfile(@Tx() tx: IncomingTx, @Param('name') name: string, @Param('homeAddress') homeAddress: string) {
    const sender = tx.sender
    await preload(this, ['users', sender] as any)
    
    const user = await this.users.get(sender)
    user.name = name
    user.homeAddress = homeAddress
    this.users.set(sender, user)
    
    this.log.info(`Profile updated for ${name}`)
  }

  @Action()
  async adminAddEmployee(@Tx() tx: IncomingTx, @Param('userAddress') userAddress: string, @Param('officeId') officeId: string) {
    await preload(this, ['users', tx.sender, userAddress] as any)
    
    const admin = await this.users.get(tx.sender)
    
    if (admin.role !== 'admin') {
      throw new Error('Only admin can add employees')
    }

    const user = await this.users.get(userAddress)
    
    if (user.role !== 'user') {
      throw new Error('Can only promote users to employees')
    }

    user.role = 'employee'
    user.officeId = officeId
    this.users.set(userAddress, user)
    
    this.log.info(`User ${userAddress} promoted to employee with office ${officeId}`)
  }

  @Action()
  async adminRemoveEmployee(@Tx() tx: IncomingTx, @Param('userAddress') userAddress: string) {
    await preload(this, ['users', tx.sender, userAddress] as any)
    
    const admin = await this.users.get(tx.sender)
    
    if (admin.role !== 'admin') {
      throw new Error('Only admin can remove employees')
    }

    const user = await this.users.get(userAddress)
    
    if (user.role !== 'employee') {
      throw new Error('User is not an employee')
    }

    user.role = 'user'
    user.officeId = undefined
    this.users.set(userAddress, user)
    
    this.log.info(`Employee ${userAddress} demoted to user`)
  }

  @Action()
  async adminChangeOffice(@Tx() tx: IncomingTx, @Param('userAddress') userAddress: string, @Param('newOfficeId') newOfficeId: string) {
    await preload(this, ['users', tx.sender, userAddress] as any)
    
    const admin = await this.users.get(tx.sender)
    
    if (admin.role !== 'admin') {
      throw new Error('Only admin can change office')
    }

    const employee = await this.users.get(userAddress)
    
    if (employee.role !== 'employee') {
      throw new Error('User is not an employee')
    }

    employee.officeId = newOfficeId
    this.users.set(userAddress, employee)
    
    this.log.info(`Office changed for ${userAddress} to ${newOfficeId}`)
  }

  @Action()
  async createShipment(
    @Tx() tx: IncomingTx, 
    @Param('recipient') recipient: string,
    @Param('type') type: 'letter' | 'parcel' | 'package',
    @Param('class') classNum: 1 | 2 | 3,
    @Param('weight') weight: number,
    @Param('declaredValue') declaredValue: number,
    @Param('fromAddress') fromAddress: string,
    @Param('toAddress') toAddress: string
  ) {
    await preload(this, ['users', tx.sender, recipient] as any)
    
    const employee = await this.users.get(tx.sender)
    
    if (employee.role !== 'employee') {
      throw new Error('Only employees can create shipments')
    }

    if (weight > 10 || weight <= 0) {
      throw new Error('Weight must be between 0 and 10 kg')
    }

    // Calculate costs (1 day = 5 seconds)
    const classCosts: Record<number, { costPerKg: number, days: number }> = {
      1: { costPerKg: 0.5, days: 5 },
      2: { costPerKg: 0.3, days: 10 },
      3: { costPerKg: 0.1, days: 15 }
    }
    
    const shipmentClass = classNum || 3
    const costData = classCosts[shipmentClass]
    const deliveryCost = costData.costPerKg * weight
    const totalCost = deliveryCost + (declaredValue * 0.1)
    
    const senderUser = await this.users.get(tx.sender)
    
    if (senderUser.balance < totalCost) {
      throw new Error('Insufficient balance')
    }

    // Generate track number: RRDDMMYYYYNNNXXXXXXYYYYYY
    const now = Math.floor(Date.now() / 1000)
    const dateStr = new Date(now * 1000).toISOString().slice(8, 19).replace(/[-:T]/g, '').slice(0, 8)
    const seqNum = (await this.shipmentCount.get()) + 1
    const trackNumber = `RR${dateStr}${String(seqNum).padStart(3, '0')}${employee.officeId!.slice(2)}${toAddress.slice(-6)}`

    const shipment: Shipment = {
      trackNumber,
      sender: tx.sender,
      recipient,
      type,
      class: shipmentClass,
      deliveryCost,
      weight,
      declaredValue,
      totalCost,
      fromAddress,
      toAddress,
      status: 'created',
      deliveryDeadline: now + (costData.days * 24 * 60 * 5), // 5 sec per day
      history: [{
        timestamp: now,
        officeId: employee.officeId!,
        employee: tx.sender
      }]
    }

    this.shipments.set(trackNumber, shipment)
    this.shipmentCount.set(seqNum)

    // Deduct payment
    senderUser.balance -= totalCost
    this.users.set(tx.sender, senderUser)

    this.log.info(`Shipment created: ${trackNumber}, cost: ${totalCost} WEST`)
  }

  @Action()
  async transitShipment(@Tx() tx: IncomingTx, @Param('trackNumber') trackNumber: string) {
    await preload(this, ['users', tx.sender, trackNumber, 'shipments'] as any)
    
    const employee = await this.users.get(tx.sender)
    
    if (employee.role !== 'employee') {
      throw new Error('Only employees can process shipments')
    }

    const shipment = await this.shipments.get(trackNumber)
    
    if (!shipment || shipment.status === 'delivered' || shipment.status === 'refused') {
      throw new Error('Shipment not found or already completed')
    }

    shipment.history.push({
      timestamp: Math.floor(Date.now() / 1000),
      officeId: employee.officeId!,
      employee: tx.sender
    })

    if (shipment.status === 'created') {
      shipment.status = 'in_transit'
    }

    this.shipments.set(trackNumber, shipment)
    this.log.info(`Shipment ${trackNumber} processed at ${employee.officeId}`)
  }

  @Action()
  async deliverShipment(@Tx() tx: IncomingTx, @Param('trackNumber') trackNumber: string) {
    await preload(this, ['users', tx.sender, trackNumber, 'shipments'] as any)
    
    const employee = await this.users.get(tx.sender)
    
    if (employee.role !== 'employee') {
      throw new Error('Only employees can deliver shipments')
    }

    const shipment = await this.shipments.get(trackNumber)
    
    if (shipment.status !== 'in_transit') {
      throw new Error('Shipment not ready for delivery')
    }

    if (Math.floor(Date.now() / 1000) > shipment.deliveryDeadline) {
      throw new Error('Delivery deadline exceeded')
    }

    shipment.status = 'delivered'
    shipment.history.push({
      timestamp: Math.floor(Date.now() / 1000),
      officeId: employee.officeId!,
      employee: tx.sender
    })

    this.shipments.set(trackNumber, shipment)
    this.log.info(`Shipment ${trackNumber} delivered`)
  }

  @Action()
  async refuseShipment(@Tx() tx: IncomingTx, @Param('trackNumber') trackNumber: string) {
    await preload(this, ['users', tx.sender, trackNumber, 'shipments'] as any)
    
    const shipment = await this.shipments.get(trackNumber)
    
    if (!shipment || shipment.status === 'delivered' || shipment.status === 'refused') {
      throw new Error('Shipment not found or already completed')
    }

    // Only recipient, admin or employee can refuse
    const user = await this.users.tryGet(tx.sender)
    
    if (!user || (user.role !== 'admin' && tx.sender !== shipment.recipient)) {
      throw new Error('Not authorized to refuse this shipment')
    }

    shipment.status = 'refused'
    
    this.shipments.set(trackNumber, shipment)
    this.log.info(`Shipment ${trackNumber} refused by ${tx.sender}`)
  }

  @Action()
  async sendMoneyTransfer(@Tx() tx: IncomingTx, @Param('recipient') recipient: string, @Param('amount') amount: number, @Param('lifetimeDays') lifetimeDays: number) {
    await preload(this, ['users', tx.sender, recipient] as any)
    
    const senderUser = await this.users.get(tx.sender)
    
    if (senderUser.balance < amount) {
      throw new Error('Insufficient balance')
    }

    const id = `TR${await this.transferCount.get() + 1}_${Date.now()}`
    const lifetime = lifetimeDays * 24 * 60 * 5 // 5 sec per day

    this.transfers.set(id, {
      id,
      sender: tx.sender,
      recipient,
      amount,
      lifetime,
      status: 'pending',
      createdAt: Math.floor(Date.now() / 1000)
    })

    senderUser.balance -= amount
    this.users.set(tx.sender, senderUser)
    this.transferCount.set(await this.transferCount.get() + 1)

    this.log.info(`Money transfer ${id} sent: ${amount} WEST`)
  }

  @Action()
  async acceptMoneyTransfer(@Tx() tx: IncomingTx, @Param('transferId') transferId: string) {
    await preload(this, ['users', tx.sender, 'transfers', transferId] as any)
    
    const transfer = await this.transfers.get(transferId)
    
    if (
      transfer.status !== 'pending' || transfer.recipient !== tx.sender || 
      Math.floor(Date.now() / 1000) > transfer.createdAt + transfer.lifetime
    ) {
      throw new Error('Cannot accept this transfer')
    }

    const recipientUser = await this.users.get(tx.sender)
    recipientUser.balance += transfer.amount
    this.users.set(tx.sender, recipientUser)

    transfer.status = 'accepted'
    this.transfers.set(transferId, transfer)

    this.log.info(`Transfer ${transferId} accepted by ${tx.sender}`)
  }

  @Action()
  async cancelMoneyTransfer(@Tx() tx: IncomingTx, @Param('transferId') transferId: string) {
    await preload(this, ['users', tx.sender, 'transfers', transferId] as any)
    
    const transfer = await this.transfers.get(transferId)
    
    if (
      transfer.status !== 'pending' || transfer.sender !== tx.sender ||
      Math.floor(Date.now() / 1000) > transfer.createdAt + transfer.lifetime
    ) {
      throw new Error('Cannot cancel this transfer')
    }

    const senderUser = await this.users.get(tx.sender)
    senderUser.balance += transfer.amount
    this.users.set(tx.sender, senderUser)

    transfer.status = 'cancelled'
    this.transfers.set(transferId, transfer)

    this.log.info(`Transfer ${transferId} cancelled by ${tx.sender}`)
  }

  @Action()
  async refuseMoneyTransfer(@Tx() tx: IncomingTx, @Param('transferId') transferId: string) {
    await preload(this, ['users', tx.sender, 'transfers', transferId] as any)
    
    const transfer = await this.transfers.get(transferId)
   
    if (
      transfer.status !== 'pending' || transfer.recipient !== tx.sender ||
      Math.floor(Date.now() / 1000) > transfer.createdAt + transfer.lifetime
    ) {
      throw new Error('Cannot refuse this transfer')
    }

    transfer.status = 'refused'
    this.transfers.set(transferId, transfer)

    this.log.info(`Transfer ${transferId} refused by ${tx.sender}`)
  }

  @Action()
  async getUserInfo(@Tx() tx: IncomingTx, @Param('address') address: string) {
    await preload(this, ['users', address] as any)
   
    const user = await this.users.tryGet(address)
   
    return user || null
  }

  @Action()
  async getShipment(@Tx() tx: IncomingTx, @Param('trackNumber') trackNumber: string) {
    await preload(this, [trackNumber, 'shipments'] as any)
   
    return await this.shipments.tryGet(trackNumber)
  }
}
