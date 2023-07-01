import React from 'react';
import Loading from '../Loading';
import { getPSMFFieldUrl } from '../../Model/psmfFacade';

interface IProps {
	field: string | undefined;
}

function FieldCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Hřiště
			</div>
			<div className="card-body">
				{props.field
				? <blockquote className="blockquote mb-0">
					<p>
						<a href={getPSMFFieldUrl(props.field)} target='_blank' rel="noreferrer">
							<span className="fa fa-external-link icon-external"/> {props.field}
						</a>
					</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default FieldCard;
