import React from 'react';
import moment from 'moment';
import classNames from 'classnames';
import Loading from '../Loading';
import MatchDate from './MatchDate';
import MatchTime from './MatchTime';

interface IProps {
	startsAt: Date | undefined;
}

function MatchTimeCard(props: IProps) {
	const now = new Date();

	return (
		<div className={classNames('card', {
			'bg-success text-white': props.startsAt && moment(props.startsAt).diff(now, 'days') < 7 && moment(props.startsAt).diff(now, 'days') > -1,
			'bg-secondary text-white': moment(props.startsAt).diff(now, 'days') <= -1,
		})}>
			<div className="card-header">
				Čas zápasu
			</div>
			<div className="card-body">
				{props.startsAt
				? <blockquote className="blockquote mb-0">
					<p><MatchDate startsAt={props.startsAt}/></p>
					<p><MatchTime startsAt={props.startsAt}/></p>
				</blockquote>
				: <Loading/>}
			</div>
		</div>
	);
}
export default MatchTimeCard;
