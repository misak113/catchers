import React from 'react';
import { SettleUpType, getSettleUpGroupUrl } from '../../Model/settleUpFacade';
import './JoinGroupLink.css';

interface IJoinGroupLinkProps {
	type: SettleUpType;
	title: string;
}

export const JoinGroupLink = (props: IJoinGroupLinkProps) => {
	return <div className='JoinGroupLink-settle-up-link'>
		<a className="external" target="_blank" rel="noopener noreferrer" href={getSettleUpGroupUrl(props.type)}>
			Přejít na Settle Up (Dlužebníček) - {props.title} <i className="fa fa-external-link icon-external"/>
		</a>
	</div>
};
