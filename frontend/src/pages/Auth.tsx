import { useState } from "react";
import { callContract, wait, type contractParams } from "../api";

type TLoginData = {
    login?: string, 
    password?: string
}

type TRegisterData = {
    login?: string, 
    fullName?: string, 
    homeAddress?: string, 
    password?: string
    repeatPassword?: string
}

export const Auth = () => {
    const [type, setType] = useState("login");
    const [loginData, setLoginData] = useState<TLoginData>({});
    const [registerData, setRegisterData] = useState<TRegisterData>({});
    
    const onLoginSubmit = (e: any) => {
        e.preventDefault();

        console.log(loginData);

        if (!loginData.login || !loginData.password) {
            return;
        }

        // const params: contractParams[] = [
        //     {
        //         key: 'action',
        //         value: 'register',
        //         type: 'string'
        //     },
        // ]
    }

    const onRegisterSubmit = async (e: any) => {
        e.preventDefault();

        console.log(registerData);
        
        const params: contractParams[] = [
            {
                key: 'action',
                value: 'register',
                type: 'string'
            },
            {
                key: 'login',
                value: 'login',
                type: 'string'
            },
            {
                key: 'password',
                value: 'password',
                type: 'string'
            },
            {
                key: 'name',
                value: 'fullName',
                type: 'string'
            },
            {
                key: 'homeAddress',
                value: 'homeAddress',
                type: 'string'
            },
            {
                key: 'homeAddress',
                value: 'homeAddress',
                type: 'string'
            },
        ];

        try {
            const tx = await callContract(params);
            console.log('Transaction ', tx);

            await wait(tx);

            console.log('Register completed');
        } catch (error) {
            console.error("Register failed: ", error);
        }
    }

    const onChange = (e: any) => {
        if (type === 'login') {
            const { name, value } = e.target;

            setLoginData((prev) => {
                return {
                    ...prev,
                    [name]: value
                };
            });
        }
        
        if (type === 'register') {
            const { name, value } = e.target;

            setRegisterData((prev) => {
                return {
                    ...prev,
                    [name]: value
                };
            });
        }
    }

    return (
        <section className="auth">
            {type === 'login' && (
                <form onSubmit={onLoginSubmit} onChange={onChange}>
                    <input type="text" placeholder="Login" name="login" />
                    <input type="password" placeholder="Password" name="password" />

                    <button type="submit">Login</button>
                </form>
            )}

            {type === 'register' && (
                <form onSubmit={onRegisterSubmit} onChange={onChange}>
                    <input type="text" placeholder="Login" name="login" />
                    <input type="text" placeholder="Home Address" name="homeAddress" />
                    <input type="text" placeholder="Full Name" name="fullName" />
                    <input type="password" placeholder="Password" name="password" />
                    <input type="password" placeholder="Repeat password" name="repeatPassword" />
                    
                    <button type="submit">Register</button>
                </form>
            )}

            {type === 'login' && (
                <button className="change-type" onClick={() => setType('register')}>
                    Зарегистрироваться 
                </button>
            )}

            {type === 'register' && (
                <button className="change-type" onClick={() => setType('login')}>
                    Войти
                </button>
            )}
            
        </section>
    );
}