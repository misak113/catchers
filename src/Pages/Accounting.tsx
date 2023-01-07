import React from 'react';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import './Accounting.css';

const Accounting: React.FC<IAuthValue> = (props: IAuthValue) => {
	return <div className='Accounting'>
		<h1>Účetnictví</h1>
	</div>
};
export default withAuth(Accounting);
