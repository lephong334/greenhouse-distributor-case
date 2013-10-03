// Modules dependencies
// ---------------------------
var https = require('https');

/**
 * Manage login/authentication Redirect on login page if there aren't access_token in current session
 */
exports.checkAuth = function(req, res, next) {
	if (!req.session.access_token) {
		// to access-token, we go to the login page
		res.redirect('/login');
	}else if (req.session.expires_at - 3600000 > new Date().getTime()){
		// access token will expire, so we try to get a new one transparently
		
		// request option
		var options = {
			host : 'qa-trunk.airvantage.net',
			path : '/api/oauth/token?grant_type=refresh_token&refresh_token='+req.session.refresh_token+'&client_id=04bd864937ac4d6b9ef3852ff3d4cc19&client_secret=278dc41dded146e291d92e2154d9b708',
		};
	
		// create request to get refresh token 
		var r = https.request(options, function(resp) {
			resp.setEncoding("utf8");
			
			resp.on('data', function(chunk) {
				try{
					if (resp.statusCode == 200) {
						// on success, refresh access token and continue to the requested page
						var token = JSON.parse(chunk);
						req.session.access_token = token.access_token;
						req.session.refresh_token = token.refresh_token;
						req.session.expires_at = new Date().getTime() + token.expires_in * 1000;
						console.log("refresh access token :"+ chunk);
						next();
					} else {
						// we don't succed to refresh token, we go to the login page.
						console.log('AirVantage return an unexpected status code ('+ resp.statusCode+") : "+ chunk);
						res.redirect('/login');
					};
				}catch (e){
					// if we get an unexpected response, log it an go to the login page
					console.log(e);
					res.redirect('/login');
				};
			});

		});
		
		// manage error on request
		r.on('error', function (e){
			// if an unexpected error occurred, log it an go to the login page
			console.log(e);
			res.redirect('/login');
		});
		
		// execute request
		r.end();
	}else{
		next();
	}
};

exports.signin = {};

/** render login page */
exports.signin.get = function(req, res) {
	res.render('login', {title : "login"});
};

/** try get access_token for AirVantage */
exports.signin.post = function(req, res,next) {

	// request options
	var options = {
		host : 'qa-trunk.airvantage.net',
		path : '/api/oauth/token?grant_type=password&username=' + req.body.username + '&password=' + req.body.password + '&client_id=04bd864937ac4d6b9ef3852ff3d4cc19&client_secret=278dc41dded146e291d92e2154d9b708',
	};
	
	// create request to get access token to AirVantage
	var r = https.request(options, function(resp) {
		resp.setEncoding("utf8");
		
		resp.on('data', function(chunk) {
			try{
				if (resp.statusCode == 200) {
					// on success, get access token an redirect to main page
					console.log (chunk);
					var token = JSON.parse(chunk);
					req.session.access_token = token.access_token;
					req.session.refresh_token = token.refresh_token;
					req.session.expires_at = new Date().getTime() + token.expires_in * 1000;
					res.redirect('/');
				} else if (resp.statusCode == 400) {
					// on error, display login page with error message
					var error = JSON.parse(chunk);
					res.render('login', {
						title : "login",
						errormsg : error.error_description,
					});
				}else{
					next (new Error('AirVantage return an unexpected status code : '+ resp.statusCode));
				}
			}catch(e){
				next(e);
			}
		});
	});

	// manage error on request
	r.on('error', function (e){
		next(e);
	});
	
	// execute request
	r.end();
};

exports.signout = {};
/** clear session : delete login information */
exports.signout.post = function(req, res) {
	req.session.access_token = null;
	req.session.refresh_token = null;
	req.session.expires_at = null;
	res.render('login', {title : "login"});
};
