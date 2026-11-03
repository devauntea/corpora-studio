"""Original sculpted surface landmarks in decimeters; shared across body variants.
Smooth analytic fields add volume/creases to the subdivision surface, not screen-space shading.
"""
import math

def bony_landmarks(p,joints,hands):
 """Small shared hard landmarks; average bodies retain these as well as fit ones."""
 x,y,z=p;side='L' if x>=0 else 'R';j=joints[side];result=p[:]
 def g(v,r):return math.exp(-(v/r)**2)
 def smooth(a,b,t):
  q=max(0,min(1,(t-a)/(b-a)));return q*q*(3-2*q)
 if y<.8 and abs(x)<3:
  kx,ky,kz=j['knee'];ax,ay,az=j['ankle']
  front=smooth(kz+.15,kz+.45,z)
  result[2]+=.04*g(x-kx,.22)*g(y-ky,.25)*front
  result[2]-=.009*g(x-kx,.23)*g(y-ky+.28,.07)*front
  for sign,level in [(-1,.12),(1,.24)]:
   result[0]+=sign*.04*g(x-ax-sign*.22,.13)*g(y-ay-level,.17)*g(z-az,.35)
  back=1-smooth(az-.25,az-.08,z)
  result[2]-=.032*g(x-ax,.12)*g(y-ay-.8,.7)*back
 elif sum((p[c]-j['wrist'][c])**2 for c in range(3))<4:
  wr=j['wrist'];fingers=hands[side]
  across=[fingers[1][0][c]-fingers[4][0][c] for c in range(3)]
  length=[fingers[2][0][c]-wr[c] for c in range(3)]
  n=[across[1]*length[2]-across[2]*length[1],across[2]*length[0]-across[0]*length[2],across[0]*length[1]-across[1]*length[0]]
  size=math.sqrt(sum(v*v for v in n));n=[v/max(size,1e-9) for v in n]
  if n[0]*(1 if side=='L' else -1)<0:n=[-v for v in n]
  for finger in fingers[1:]:
   for index,knuckle in enumerate(finger[:2]):
    q=[p[c]-knuckle[c] for c in range(3)];height=sum(q[c]*n[c] for c in range(3))
    tangent=math.sqrt(max(0,sum(v*v for v in q)-height*height))
    relief=(.022 if index==0 else .012)*g(tangent,.15 if index==0 else .10)*smooth(.015,.055,height)*g(height,.20)
    for c in range(3):result[c]+=n[c]*relief
 return result

def sculpt(p,weights,joints,sex):
 x,y,z=p; ax=abs(x);sgn=1 if x>=0 else -1; female=sex=='female'; strength=.62 if female else 1
 def g(a,s):return math.exp(-((a/s)**2))
 def smooth(a,b,t):
  q=max(0,min(1,(t-a)/(b-a)));return q*q*(3-2*q)
 arm=max(weights[0],weights[3]);dz=0;dx=0
 front=smooth(.25,.85,z);back=1-smooth(-.65,-.15,z)
 trunk=(1-smooth(.05,.55,arm))*smooth(.7,1.3,y)
 # Broad pectoral plane; lower border and medial separation. Keep female breast topology.
 if not female:
  pec=g((ax-.92)/.88,1)*g(y-(4.98+.07*ax),.75)
  dz+=front*(.11*pec-.016*g(y-(4.30+.10*ax),.12)*g(ax-.90,.78))
  dz-=front*.025*g(x,.10)*g(y-5.05,.8)
 # Rectus columns: rounded rectangles with thin tendinous intersections, not stacked spheres.
 for cy,ry,amp in [(4.05,.30,.065),(3.42,.29,.085),(2.80,.28,.075),(2.13,.40,.045)]:
  shape=math.exp(-((ax-.40)/.35)**4-((y-cy)/ry)**4)
  dz+=front*strength*amp*shape
 dz-=front*.020*strength*g(x,.09)*g(y-3.45,1.25)
 # Oblique/serratus rhythm follows ribs toward the flank.
 for i in range(3):
  yy=4.38-i*.27-.37*(ax-1.25)
  dz+=front*.012*strength*g(y-yy,.11)*g(ax-1.40,.19)
 dz+=front*.07*strength*g(ax-(1.12+.10*(y-3)),.20)*g(y-3.25,.85)
 # Clavicles have an S-shaped sweep, with a shallow infraclavicular hollow.
 clav=5.98+.11*math.sin((ax-.2)*2.1)
 dz+=front*(.04*g(y-clav,.11)-.015*g(y-clav+.16,.14))*g(ax-1,.88)
 # Scapular and spinal planes on the back; valleys continue into the lumbar area.
 dz-=back*strength*(.08*g(ax-1.03,.48)*g(y-5.10,.65)+.055*g(ax-.34,.26)*g(y-3.7,1.6))
 dz+=back*.045*g(x,.10)*g(y-4.2,1.7)
 dz-=back*.025*strength*g(y-(5.5-.48*ax),.085)*g(ax-.9,.65)
 dx+=sgn*strength*.10*g(ax-1.38,.22)*g(y-4.32,.70)
 result=[x+dx*trunk,y,z+dz*trunk]
 # Rounded muscle bellies and bony transition ridges along the actual limb axes.
 def limb(a,b,p):
  axis=[b[i]-a[i] for i in range(3)];length=math.sqrt(sum(v*v for v in axis));axis=[v/length for v in axis]
  q=[p[i]-a[i] for i in range(3)];t=sum(q[i]*axis[i] for i in range(3))/length
  off=[q[i]-axis[i]*t*length for i in range(3)];r=math.sqrt(sum(v*v for v in off))
  return t,off,r
 side='L' if x>=0 else 'R';j=joints[side];w=weights[0 if x>=0 else 3]
 if w>.05:
  t,off,r=limb(j['shoulder'],j['elbow'],p)
  if r>.01:
   f=off[2]/r;outer=off[0]*sgn/r
   delta=(.095*g(t-.14,.22)+.09*g(t-.54,.25)*max(0,f)+.065*g(t-.6,.3)*max(0,-f))
   delta-=.025*g(t-.35,.055)*max(0,outer)
   for c in range(3):result[c]+=off[c]/r*delta*strength*w
  t,off,r=limb(j['elbow'],j['wrist'],p)
  if r>.01 and 0<t<1:
   theta=math.atan2(off[0]*sgn,off[2]);delta=.055*g(t-.32,.25)*(1+.22*math.cos(3*theta))
   delta+=.016*g(t-.65,.27)*max(0,math.cos(3*theta+.5*t))
   for c in range(3):result[c]+=off[c]/r*delta*strength*w
 if y<.8:
  t,off,r=limb(j['hip'],j['knee'],p)
  if r>.01 and 0<t<1:
   theta=math.atan2(off[0]*sgn,off[2]);frontside=max(0,math.cos(theta));delta=.08*g(t-.46,.3)*frontside+.085*g(t-.81,.12)*max(0,math.cos(theta+.8))
   for c in range(3):result[c]+=off[c]/r*delta*strength
  t,off,r=limb(j['knee'],j['ankle'],p)
  if r>.01 and 0<t<1:
   theta=math.atan2(off[0]*sgn,off[2]);delta=.08*g(t-.32,.2)*max(0,-math.cos(theta))+.035*g(t-.46,.35)*g(theta,.3)
   for c in range(3):result[c]+=off[c]/r*delta*strength
 return result
