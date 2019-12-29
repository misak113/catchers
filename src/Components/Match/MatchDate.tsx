import React from 'react';
import moment from 'moment';

interface IProps {
	startsAt: Date;
}

function MatchDate(props: IProps) {
	return <>
		{moment(props.startsAt).format('LL')} <small>{moment(props.startsAt).format('ddd')}</small>
	</>;
}
export default MatchDate;
