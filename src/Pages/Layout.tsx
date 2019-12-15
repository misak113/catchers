import React, { useState } from 'react';
import classNames from 'classnames';
import './Layout.css';
import Anchor from '../Components/Anchor';
import Homepage from './Homepage';
import Matches from './Matches';
import logo from '../logo-large.png';
import 'moment/locale/cs';
import { IAuthValue, withAuth } from '../Context/AuthContext';

const pages = [
	{
		name: 'SC Catchers',
		path: '/',
		render: () => <Homepage/>,
		hiddenInMenu: true,
	},
	{
		name: 'Zápasy',
		path: '/zapasy',
		render: () => <Matches/>,
	},
];

interface IProps {}

const Layout: React.FC<IProps & IAuthValue> = (props: IProps & IAuthValue) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentPath, changePath] = useState(window.location.pathname);
	window.onpopstate = window.history.onpushstate = () => setTimeout(() => changePath(window.location.pathname));
	const currentPage = pages.find((page) => page.path === currentPath);
	return (
		<div className="Layout">
			<header className="Layout-header">
				<nav className="navbar navbar-expand-lg navbar-dark bg-dark">
					<Anchor className="navbar-brand" href="/">SC Catchers</Anchor>
					<button className="navbar-toggler" type="button" onClick={() => setMenuOpen(!menuOpen)}>
						<span className="navbar-toggler-icon"></span>
					</button>

					<div className="collapse navbar-collapse" style={{ display: menuOpen ? 'block' : 'none' }}>
						<ul className="navbar-nav mr-auto">
							{pages.filter((page) => !page.hiddenInMenu).map((page) => (
								<li key={page.path} className={classNames("nav-item", {
									'active': page.path === currentPath,
								})}>
									<Anchor
										className="nav-link"
										href={page.path}
									>
										{page.name}
										{page.path === currentPath ? <span className="sr-only">(current)</span> : null}
									</Anchor>
								</li>
							))}
						</ul>
						{props.auth.signingIn ? (
							<span className="nav-link">loading</span>
						) : props.auth.userCredentials ? <span className="nav-link" title={props.auth.userCredentials.user!.email!}>
							<img src={props.auth.userCredentials.user!.photoURL!} width={16} height={16}/> {props.auth.userCredentials.user!.displayName} <small><a
								href="#"
								onClick={(event) => {
									event.preventDefault();
									props.auth.logout();
								}}
							>
								odhlásit
							</a></small>
						</span> : (
							<a className="nav-link" href="#" onClick={(event) => {
								event.preventDefault();
								props.auth.loginFacebook();
							}}>
								<i className="fa fa-facebook"/> přihlásit
							</a>
						)}
						<a className="nav-link external" target="_blank" rel="noopener noreferrer" href="http://www.psmf.cz">
							PSMF <i className="fa fa-external-link"/>
						</a>
					</div>
				</nav>
			</header>
			<section className="container Layout-content">
				{currentPage ? (
					currentPage.render && currentPage.render()
				) : (
					<>
						<h1>SC Catchers - Stránka nenalezena</h1>
						<p>Tato stránka nebyla nalezena. Prosím pokračuj na <Anchor href="/">stránce týmu</Anchor></p>
						<img src={logo} className="Layout-logo" alt="logo" />
					</>
				)}
			</section>
			<footer className="Layout-footer"></footer>
		</div>
	);
}

export default withAuth(Layout);
