'use strict'

const fp = require('fastify-plugin')
// External utilities
const forwarded = require('forwarded')
const proxyaddr = require('proxy-addr')
const typeis = require('type-is')
// Internals Utilities
const httpErrors = require('./lib/httpErrors')
const assert = require('./lib/assert')
const vary = require('./lib/vary')

function fastifySensible (fastify, opts, next) {
  fastify.decorate('httpErrors', httpErrors)
  fastify.decorate('assert', assert)
  fastify.decorate('to', to)

  fastify.decorateRequest('forwarded', function () {
    return forwarded(this.raw)
  })

  fastify.decorateRequest('proxyaddr', function (trust) {
    return proxyaddr(this.raw, trust)
  })

  fastify.decorateRequest('is', function (types) {
    return typeis(this.raw, Array.isArray(types) ? types : [types])
  })

  fastify.decorateReply('vary', vary)

  // TODO: benchmark if this closure causes some performance drop
  Object.keys(httpErrors).forEach(httpError => {
    fastify.decorateReply(httpError, function (message) {
      this.send(httpErrors[httpError](message))
    })
  })

  if (opts.errorHandler !== false) {
    fastify.setErrorHandler(function (error, request, reply) {
      if (reply.res.statusCode === 500) {
        request.log.error(error)
        reply.send(new Error('Something went wrong'))
      } else {
        reply.send(error)
      }
    })
  }

  function to (promise) {
    return promise.then(data => [null, data], err => [err, undefined])
  }

  next()
}

module.exports = fp(fastifySensible, {
  name: 'fastify-sensible',
  fastify: '2.x'
})
