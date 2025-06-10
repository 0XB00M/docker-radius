/*
*
* PostgreSQL schema for FreeRADIUS
*
*/

/*
* Table structure for table 'radacct'
*
*/
CREATE TABLE IF NOT EXISTS radacct (
       RadAcctId               bigserial PRIMARY KEY,
       AcctSessionId           text NOT NULL,
       AcctUniqueId            text NOT NULL UNIQUE,
       UserName                text,
       Realm                   text,
       NASIPAddress            inet NOT NULL,
       NASPortId               text,
       NASPortType             text,
       AcctStartTime           timestamp with time zone,
       AcctUpdateTime          timestamp with time zone,
       AcctStopTime            timestamp with time zone,
       AcctInterval            bigint,
       AcctSessionTime         bigint,
       AcctAuthentic           text,
       ConnectInfo_start       text,
       ConnectInfo_stop        text,
       AcctInputOctets         bigint,
       AcctOutputOctets        bigint,
       CalledStationId         text,
       CallingStationId        text,
       AcctTerminateCause      text,
       ServiceType             text,
       FramedProtocol          text,
       FramedIPAddress         inet,
       FramedIPv6Address       inet,
       FramedIPv6Prefix        inet,
       FramedInterfaceId       text,
       DelegatedIPv6Prefix     inet,
       Class                   text
);

-- For use by update-, stop- and simul_* queries
CREATE INDEX radacct_active_session_idx ON radacct (AcctUniqueId) WHERE AcctStopTime IS NULL;

-- For use by on-off-
CREATE INDEX radacct_bulk_close ON radacct (NASIPAddress, AcctStartTime) WHERE AcctStopTime IS NULL;

-- and for common statistic queries:
CREATE INDEX radacct_start_user_idx ON radacct (AcctStartTime, UserName);

-- and for Class
CREATE INDEX radacct_calss_idx ON radacct (Class);


/*
* Table structure for table 'radcheck'
*/
CREATE TABLE IF NOT EXISTS radcheck (
       id                      serial PRIMARY KEY,
       UserName                text NOT NULL DEFAULT '',
       Attribute               text NOT NULL DEFAULT '',
       op                      VARCHAR(2) NOT NULL DEFAULT '==',
       Value                   text NOT NULL DEFAULT ''
);

create index radcheck_UserName on radcheck (UserName,Attribute);

/*
* Table structure for table 'radgroupcheck'
*/
CREATE TABLE IF NOT EXISTS radgroupcheck (
       id                      serial PRIMARY KEY,
       GroupName               text NOT NULL DEFAULT '',
       Attribute               text NOT NULL DEFAULT '',
       op                      VARCHAR(2) NOT NULL DEFAULT '==',
       Value                   text NOT NULL DEFAULT ''
);

create index radgroupcheck_GroupName on radgroupcheck (GroupName,Attribute);

/*
* Table structure for table 'radgroupreply'
*/
CREATE TABLE IF NOT EXISTS radgroupreply (
       id                      serial PRIMARY KEY,
       GroupName               text NOT NULL DEFAULT '',
       Attribute               text NOT NULL DEFAULT '',
       op                      VARCHAR(2) NOT NULL DEFAULT '=',
       Value                   text NOT NULL DEFAULT ''
);

create index radgroupreply_GroupName on radgroupreply (GroupName,Attribute);

/*
* Table structure for table 'radreply'
*/
CREATE TABLE IF NOT EXISTS radreply (
       id                      serial PRIMARY KEY,
       UserName                text NOT NULL DEFAULT '',
       Attribute               text NOT NULL DEFAULT '',
       op                      VARCHAR(2) NOT NULL DEFAULT '=',
       Value                   text NOT NULL DEFAULT ''
);

create index radreply_UserName on radreply (UserName,Attribute);

/*
* Table structure for table 'radusergroup'
*/
CREATE TABLE IF NOT EXISTS radusergroup (
       id                      serial PRIMARY KEY,
       UserName                text NOT NULL DEFAULT '',
       GroupName               text NOT NULL DEFAULT '',
       priority                integer NOT NULL DEFAULT 0
);

create index radusergroup_UserName on radusergroup (UserName);

--
-- Table structure for table 'radpostauth'
--

CREATE TABLE IF NOT EXISTS radpostauth (
       id                      bigserial PRIMARY KEY,
       username                text NOT NULL,
       pass                    text,
       reply                   text,
       CalledStationId         text,
       CallingStationId        text,
       authdate                timestamp with time zone NOT NULL default now(),
       Class                   text
);

CREATE INDEX radpostauth_username_idx ON radpostauth (username);
CREATE INDEX radpostauth_class_idx ON radpostauth (Class);

/*
* Table structure for table 'nas'
*/
CREATE TABLE IF NOT EXISTS nas (
       id                      serial PRIMARY KEY,
       nasname                 text NOT NULL,
       shortname               text NOT NULL,
       type                    text NOT NULL DEFAULT 'other',
       ports                   integer,
       secret                  text NOT NULL,
       server                  text,
       community               text,
       description             text
);

create index nas_nasname on nas (nasname);

/*
* Table structure for table 'nasreload'
*/
CREATE TABLE IF NOT EXISTS nasreload (
       NASIPAddress		inet PRIMARY KEY,
       ReloadTime		timestamp with time zone NOT NULL
);-- Insert sample test user

INSERT INTO radcheck (username, attribute, op, value) VALUES ('testuser', 'Cleartext-Password', ':=', 'testpass');
INSERT INTO radreply (username, attribute, op, value) VALUES ('testuser', 'Reply-Message', '=', 'Hello %{User-Name}');
