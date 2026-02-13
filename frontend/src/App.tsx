import { useEffect, useState } from "react";
import { getSome } from "./api";
import { Link } from "react-router";

function App() {
    const [users, setUsers] = useState();


    const init = () => {

    }

    const getUsers = async () => {
        const fullState = await getSome("");
        console.log(JSON.parse(fullState.value));
    }

    useEffect(() => {
        getUsers();
    }, []);

    return (
        <>
            App
        </>
    );
}

export default App
