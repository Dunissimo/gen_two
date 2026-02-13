import { CONTRACT_ID, NODE_ADDRESS, NODE_KEY } from '../../config.json';

export type contractParams = {
    key: string,
    value: unknown,
    type: string
}

export const getSome = async (endpoint: string) => {
    const raw = await fetch(`http://localhost:6862/contracts/${CONTRACT_ID}/USERS_USER-admin_admin`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    return raw.json();
}

export const callContract = async (params: contractParams[]) => {
    const body = {
        "type": 104,
        "sender": NODE_ADDRESS,
        "password": NODE_KEY,
        "contractId": CONTRACT_ID,
        "params": params,
        "fee": 0
    }

    const res = async () => {
        const raw = await fetch(`http://localhost:6862/transactions/signAndBroadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        return raw.json();
    }

    const result = await res();
    
    return result.id;
}

export const wait = async (id: string) => {
    while (true) {
        const res = await fetch(`http://localhost:6862/transactions/info/${id}`);

        if (res.ok) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return true;
}