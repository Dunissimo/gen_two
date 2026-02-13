import { NavLink, Outlet } from "react-router"

export const Layout = () => {
    
    return (
        <>
            <header>
                <nav>
                    <button>
                        <NavLink to='/'>Home</NavLink>
                    </button>
                    <button>
                        <NavLink to='/auth'>Auth</NavLink>
                    </button>
                </nav>
            </header>

            <main>
                <Outlet />        
            </main>
        </>
    )
}