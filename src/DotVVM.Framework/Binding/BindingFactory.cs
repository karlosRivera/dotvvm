﻿using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;
using DotVVM.Framework.Binding.Expressions;
using DotVVM.Framework.Compilation.Binding;

namespace DotVVM.Framework.Binding
{
    public static class BindingFactory
    {
        private static ConcurrentDictionary<Type, Func<BindingCompilationService, object[], IBinding>> bindingCtorCache = new ConcurrentDictionary<Type, Func<BindingCompilationService, object[], IBinding>>();

        /// <summary>
        /// Creates the binding by calling .ctor(BindingCompilationService service, object[] properties), does not wrap exceptions to TargetInvocationException.
        /// </summary>
        public static IBinding CreateBinding(this BindingCompilationService service, Type binding, object[] properties) =>
            bindingCtorCache.GetOrAdd(binding, type => {
                var ctor = type.GetConstructor(new[] { typeof(BindingCompilationService), typeof(object[]) }) ??
                           type.GetConstructor(new[] { typeof(BindingCompilationService), typeof(IEnumerable<object>) });
                if (ctor == null) throw new NotSupportedException($"Could not find .ctor(BindingCompilationService service, object[] properties) on binding '{binding.FullName}'.");
                var bindingServiceParam = Expression.Parameter(typeof(BindingCompilationService));
                var propertiesParam = Expression.Parameter(typeof(object[]));
                var expression = Expression.New(ctor, bindingServiceParam, TypeConversion.ImplicitConversion(propertiesParam, ctor.GetParameters()[1].ParameterType));
                return Expression.Lambda<Func<BindingCompilationService, object[], IBinding>>(expression, bindingServiceParam, propertiesParam).Compile();
            })(service, properties);
    }
}
