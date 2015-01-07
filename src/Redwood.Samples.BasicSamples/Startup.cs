﻿using System.Web.Hosting;
using Microsoft.Owin;
using Microsoft.Owin.FileSystems;
using Microsoft.Owin.StaticFiles;
using Owin;
using Redwood.Framework;
using Redwood.Framework.Configuration;
using Microsoft.Owin.Security.Cookies;
using Microsoft.AspNet.Identity;

[assembly: OwinStartup(typeof(Redwood.Samples.BasicSamples.Startup))]
namespace Redwood.Samples.BasicSamples
{
    public class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            app.UseCookieAuthentication(new CookieAuthenticationOptions()
            {
                LoginPath = new PathString("/AuthSample/Login"),
                AuthenticationType = DefaultAuthenticationTypes.ApplicationCookie
            });

            var applicationPhysicalPath = HostingEnvironment.ApplicationPhysicalPath;

            // use Redwood
            RedwoodConfiguration redwoodConfiguration = app.UseRedwood(applicationPhysicalPath);
            redwoodConfiguration.RouteTable.Add("Sample1", "Sample1", "sample1.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample2", "Sample2", "sample2.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample3", "Sample3", "sample3.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample4", "Sample4", "sample4.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample5", "Sample5", "sample5.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample6", "Sample6", "sample6.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample7", "Sample7", "sample7.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample8", "Sample8", "sample8.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample9", "Sample9", "sample9.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("Sample10", "Sample10", "sample10.rwhtml", null);

            redwoodConfiguration.RouteTable.Add("AuthSampleLogin", "AuthSample/Login", "AuthSample/login.rwhtml", null);
            redwoodConfiguration.RouteTable.Add("AuthSamplePage", "AuthSample/SecretPage", "AuthSample/secretPage.rwhtml", null);

            // use static files
            app.UseStaticFiles(new StaticFileOptions()
            {
                FileSystem = new PhysicalFileSystem(applicationPhysicalPath)
            });
        }
    }
}
