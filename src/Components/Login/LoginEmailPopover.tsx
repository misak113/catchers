import React, { useState } from 'react';
import Anchor from '../Anchor';
import './LoginEmailPopover.css';
import { getErrorMessage } from '../../Util/error';

export interface ICredentials {
	email: string;
	password: string;
}

interface IProps {
	onLogin: (credentials: ICredentials) => Promise<void>;
	onHide: () => void;
}

export default function LoginEmailPopover(props: IProps) {
	const emailRef = React.createRef<HTMLInputElement>();
	const passwordRef = React.createRef<HTMLInputElement>();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	return (
		<div className="LoginEmailPopover popover fade show bs-popover-bottom">
			<div className="arrow"></div>
			<div className="popover-body">
				<form onSubmit={async (event) => {
					event.preventDefault();
					if (emailRef.current && emailRef.current.value && passwordRef.current && passwordRef.current.value) {
						try {
							await props.onLogin({
								email: emailRef.current.value,
								password: passwordRef.current.value,
							});
						} catch (error) {
							console.error(error);
							setErrorMessage(getErrorMessage(error));
						}
					}
				}}>
					<div className="form-group">
						<label htmlFor="colFormLabelSm" className="col-form-label col-form-label-sm">E-mail</label>
						<input type="email" ref={emailRef} className="form-control form-control-sm" placeholder="E-mail"/>
					</div>
					<div className="form-group">
						<label htmlFor="colFormLabelSm" className="col-form-label col-form-label-sm">Heslo</label>
						<input type="password" ref={passwordRef} className="form-control form-control-sm" placeholder="Heslo"/>
					</div>
					<div className="form-group">
						<button type="submit" className="form-control form-control-sm">
							Přihlásit
						</button>
					</div>
					<div className="register">
						<Anchor href={'/registrace'} onClick={() => props.onHide()}>
							Zaregistrovat
						</Anchor>
					</div>
					{errorMessage && <div className="alert alert-danger">
						{errorMessage}
					</div>}
				</form>
			</div>
		</div>
	);
};
