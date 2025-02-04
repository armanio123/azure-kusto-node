
const { AuthenticationContext } = require("adal-node");

const AuthenticationMethod = Object.freeze({
    username: 0,
    appKey: 1,
    appCertificate: 2,
    deviceLogin: 3
});


module.exports = class AadHelper {
    constructor(kcsb) {
        this.token = {};

        let authority = kcsb.authorityId || "common";
        let url;
        
        // support node compatability
        try {
            url = new URL(kcsb.dataSource);
        } catch (e){            
            const URL = require("url").URL;
            url = new URL(kcsb.dataSource);            
        }

        this.kustoCluster = `${url.protocol}//${url.hostname}`;
        this.adalContext = new AuthenticationContext(`https://login.microsoftonline.com/${authority}`);
        if (!!kcsb.aadUserId && !!kcsb.password) {
            this.authMethod = AuthenticationMethod.username;
            this.clientId = "db662dc1-0cfe-4e1c-a843-19a68e65be58";
            this.username = kcsb.aadUserId;
            this.password = kcsb.password;
        } else if (!!kcsb.applicationClientId && !!kcsb.applicationKey) {
            this.authMethod = AuthenticationMethod.appKey;
            this.clientId = kcsb.applicationClientId;
            this.clientSecret = kcsb.applicationKey;
        } else if (!!kcsb.applicationClientId &&
            !!kcsb.applicationCertificate && !!kcsb.applicationCertificateThumbprint) {
            this.authMethod = AuthenticationMethod.appCertificate;
            this.clientId = kcsb.applicationClientId;
            this.certificate = kcsb.applicationCertificate;
            this.thumbprint = kcsb.applicationCertificateThumbprint;
        } else {
            this.authMethod = AuthenticationMethod.deviceLogin;
            this.clientId = "db662dc1-0cfe-4e1c-a843-19a68e65be58";
            this.authCallback = kcsb.AuthorizationCallback;
        }
    }

    getAuthHeader(cb) {
        let resource = this.kustoCluster;
        let formatHeader = ({ tokenType, accessToken }) => `${tokenType} ${accessToken}`;

        switch (this.authMethod) {
            case AuthenticationMethod.username:
                return this.adalContext.acquireTokenWithUsernamePassword(
                    resource, this.username, this.password, this.clientId, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.appKey:
                return this.adalContext.acquireTokenWithClientCredentials(
                    resource, this.clientId, this.clientSecret, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.appCertificate:
                return this.adalContext.acquireTokenWithClientCertificate(
                    resource, this.clientId, this.certificate, this.thumbprint, (err, tokenResponse) => {
                        return cb(err, tokenResponse && formatHeader(tokenResponse));
                    }
                );
            case AuthenticationMethod.deviceLogin:
                return this.adalContext.acquireUserCode(resource, this.clientId, null, (err, tokenResponse) => {
                    if (err) {
                        return cb(err);
                    } else {
                        if (this.authCallback) {
                            this.authCallback(tokenResponse);
                        } else {
                            console.log(tokenResponse.message);
                        }

                        return this.adalContext.acquireTokenWithDeviceCode(resource, this.clientId, tokenResponse, (err, tokenResponse) => {
                            if (err) {
                                return cb(err);
                            }

                            return cb(err, tokenResponse && formatHeader(tokenResponse));
                        });

                    }
                });
            default:
                return cb("Couldn't Authenticate, something went wrong trying to choose authentication method");
        }

    }
};
