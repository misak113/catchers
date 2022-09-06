import * as firebaseAuth from '@firebase/auth';
import React, { useState } from 'react';
import classNames from 'classnames';
import './Layout.css';
import Anchor from '../Components/Anchor';
import Homepage from './Homepage';
import Matches from './Matches';
import Match from './Match';
import logo from '../logo-large.png';
import 'moment/locale/cs';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import LoginEmailPopover, { ICredentials } from '../Components/Login/LoginEmailPopover';
import Register from './Register';
import { useShowPlayerLinkingModal } from '../Model/userFacade';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import PlayerLinkModal from '../Components/PlayerLinking/PlayerLinkModal';

const pages = [
	{
		name: 'SC Catchers',
		path: '/',
		render: () => <Homepage/>,
		hiddenInMenu: () => true,
	},
	{
		name: 'Zápasy',
		path: '/zapasy',
		render: () => <Matches/>,
		hiddenInMenu: (user: firebaseAuth.User | null) => !user,
	},
	{
		name: 'Zápas',
		path: /\/zapas\/(?<matchId>\w+)/,
	render: (params: any) => { console.log(params); return <Match matchId={params.matchId}/> },
		hiddenInMenu: () => true,
	},
	{
		name: 'Registrace',
		path: '/registrace',
		render: () => <Register/>,
		hiddenInMenu: () => true,
	},
];

function matchPage(path: string | RegExp, currentPath: string) {
	if (path instanceof RegExp) {
		return path.test(currentPath);
	} else {
		return path === currentPath;
	}
}

function matchParams(path: string | RegExp, currentPath: string) {
	if (path instanceof RegExp) {
		const matches = currentPath.match(path);
		return matches ? matches.groups : {};
	} else {
		return {};
	}
}

interface IProps {}

const Layout: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [loginEmailShown, setShowLoginEmail] = useState(false);
	const [currentPath, changePath] = useState(window.location.pathname);
	window.onpopstate = window.history.onpushstate = () => setTimeout(() => changePath(window.location.pathname));
	const currentPage = pages.find((page) => matchPage(page.path, currentPath));

	const showPlayerLinkingModal = useShowPlayerLinkingModal(props.firebaseApp, props.auth.user, () => null);

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
							{pages.filter((page) => !page.hiddenInMenu?.(props.auth.user)).map((page) => (
								<li key={page.path.toString()} className={classNames("nav-item", {
									'active': page.path === currentPath,
								})}>
									<Anchor
										className="nav-link"
										href={page.path.toString()}
									>
										{page.name}
										{page.path === currentPath ? <span className="sr-only">(current)</span> : null}
									</Anchor>
								</li>
							))}
						</ul>
						{props.auth.signingIn && (
							<span className="nav-link">loading</span>
						)}
						{props.auth.user ? <span className={classNames("nav-link", { hidden: props.auth.signingIn })} title={props.auth.user.email!}>
							{props.auth.user.photoURL && <img src={props.auth.user.photoURL} width={16} height={16} alt={props.auth.user.displayName || undefined}/>}
							&nbsp;
							{props.auth.user.displayName || props.auth.user.email}
							&nbsp;
							<small>
								<button className="btn btn-link" onClick={() => {
									props.auth.logout();
								}}>
									odhlásit
								</button>
							</small>
						</span> : <>
							<button className={classNames("nav-link btn btn-link login", { hidden: props.auth.signingIn })} onClick={() => {
								props.auth.loginFacebook();
							}}>
								<i className="fa fa-facebook"/> přihlásit facebookem
							</button>
							<div className={classNames("nav-link btn btn-link login", { hidden: props.auth.signingIn })}>
								<button className="btn btn-link" onClick={() => setShowLoginEmail(!loginEmailShown)}>
									<i className="fa fa-sign-in"/> přihlásit e-mailem
								</button>
								{loginEmailShown && <LoginEmailPopover
									onLogin={async (credentials: ICredentials) => {
										await props.auth.loginEmail(credentials);
									}}
									onHide={() => setShowLoginEmail(false)}
								/>}
							</div>
						</>}
						<a className="nav-link external" target="_blank" rel="noopener noreferrer" href="http://www.psmf.cz">
							PSMF <i className="fa fa-external-link"/>
						</a>
					</div>
				</nav>
			</header>
			{showPlayerLinkingModal && <PlayerLinkModal/>}
			<section className="container Layout-content">
				{currentPage ? (
					currentPage.render && currentPage.render(matchParams(currentPage.path, currentPath))
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

export default withFirebase(withAuth(Layout));
