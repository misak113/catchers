import React from 'react';
import Loading from '../Loading';

interface IProps {
	opponent: string | undefined;
}

function TeamCard(props: IProps) {
	return (
		<div className="card">
			<div className="card-header">
				Soupeř
			</div>
			<div className="card-body">
				{props.opponent
				? <blockquote className="blockquote mb-0">
					<p>{props.opponent}</p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default TeamCard;
