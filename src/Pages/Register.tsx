import React, { useState } from 'react';
import './Register.css';
import { withAuth, IAuthValue } from '../Context/AuthContext';
import { withRouter, IRouterValue } from '../Context/RouterContext';
import { getErrorMessage } from '../Util/error';

interface IProps {}

const Register: React.FC<IProps & IAuthValue & IRouterValue> = (props: IProps & IAuthValue & IRouterValue) => {
	const emailRef = React.createRef<HTMLInputElement>();
	const passwordRef = React.createRef<HTMLInputElement>();
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	return <>
		<h1>Registrace</h1>

        <form className="registerForm" onSubmit={async (event) => {
            event.preventDefault();
            if (emailRef.current && emailRef.current.value && passwordRef.current && passwordRef.current.value) {
                try {
                    await props.auth.registerEmail({
                        email: emailRef.current.value,
                        password: passwordRef.current.value,
                    });
                    props.router.goPath('/');
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
                <button disabled={props.auth.signingIn} type="submit" className="form-control form-control-sm">
                    Registrovat
                </button>
            </div>
            {errorMessage && <div className="alert alert-danger">
                {errorMessage}
            </div>}
        </form>
	</>;
};
export default withAuth(withRouter(Register));
